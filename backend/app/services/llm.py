"""Single place that builds LLM clients and calls models.

Every call gets a bounded timeout, and Groq calls walk an ordered model list so a
decommissioned or misbehaving model degrades to the next one (logged) instead of
silently dropping chat to template answers.
"""

import logging
from typing import Any

from openai import BadRequestError, NotFoundError, OpenAI, RateLimitError

from app.core.config import get_settings

logger = logging.getLogger(__name__)

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
LLM_TIMEOUT_S = 20.0
LLM_MAX_RETRIES = 1


def groq_client(timeout: float = LLM_TIMEOUT_S) -> OpenAI:
    return OpenAI(
        api_key=get_settings().groq_api_key.strip(),
        base_url=GROQ_BASE_URL,
        timeout=timeout,
        max_retries=LLM_MAX_RETRIES,
    )


def openai_client(timeout: float = LLM_TIMEOUT_S) -> OpenAI:
    return OpenAI(api_key=get_settings().openai_api_key.strip(), timeout=timeout, max_retries=LLM_MAX_RETRIES)


def groq_models() -> list[str]:
    settings = get_settings()
    chain = [settings.groq_chat_model, *settings.groq_fallback_models.split(",")]
    seen: set[str] = set()
    return [m.strip() for m in chain if m.strip() and not (m.strip() in seen or seen.add(m.strip()))]


def _model_kwargs(model: str) -> dict[str, Any]:
    # gpt-oss models reason before answering; "low" keeps latency down and leaves the
    # max_tokens budget for the answer. Other models reject the parameter.
    return {"reasoning_effort": "low"} if model.startswith("openai/gpt-oss") else {}


def complete(client: OpenAI, models: list[str], **kwargs: Any):
    """chat.completions.create over an ordered model list.

    Falls through on model-level failures: model removed, request shape rejected, or
    rate-limited (Groq quotas are per model, so the next model has its own budget).
    Transport and auth errors propagate so callers can apply their own degradation.
    """
    last_error: Exception | None = None
    for index, model in enumerate(models):
        try:
            response = client.chat.completions.create(model=model, **_model_kwargs(model), **kwargs)
            if index > 0:
                logger.warning(
                    "LLM fallback model used",
                    extra={"event": "llm_fallback", "model": model, "reason": type(last_error).__name__},
                )
            return response
        except (NotFoundError, BadRequestError, RateLimitError) as exc:
            logger.error(
                "LLM model failed: %s",
                str(exc)[:300],
                extra={"event": "llm_model_failed", "model": model, "reason": type(exc).__name__},
            )
            last_error = exc
    assert last_error is not None
    raise last_error
