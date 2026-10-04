import json
import logging
import queue
import threading

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.limiter import limiter
from app.db import DatabaseUnavailable, get_cursor, use_sqlite
from app.services.rag_service import ask, chat

router = APIRouter()
logger = logging.getLogger(__name__)


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=8000)


class AskRequest(BaseModel):
    question: str = Field(min_length=2, max_length=4000)
    lang: str = "en"


class ChatRequest(BaseModel):
    message: str = Field(min_length=2, max_length=4000)
    lang: str = "en"
    response_lang: str | None = None
    include_transliteration: bool = True
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)


class FeedbackRequest(BaseModel):
    """A vote on one answer. Sending it is the user's opt-in to share this question and answer."""

    id: str = Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    rating: int = Field(ge=-1, le=1)
    question: str = Field(min_length=1, max_length=4000)
    answer: str = Field(min_length=1, max_length=12000)
    citations: list[str] = Field(default_factory=list, max_length=20)
    source_refs: list[str] = Field(default_factory=list, max_length=20)
    lang: str | None = Field(default=None, max_length=5)
    mode: str | None = Field(default=None, max_length=60)
    llm_model: str | None = Field(default=None, max_length=80)
    comment: str | None = Field(default=None, max_length=1000)


_FEEDBACK_UPSERT_PG = """
    INSERT INTO chat_feedback (id, rating, question, answer, citations, source_refs, lang, mode, llm_model, comment)
    VALUES (%s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s, %s)
    ON CONFLICT (id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = NOW()
"""
_FEEDBACK_UPSERT_SQLITE = """
    INSERT INTO chat_feedback (id, rating, question, answer, citations, source_refs, lang, mode, llm_model, comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment,
      updated_at = CURRENT_TIMESTAMP
"""


@router.post("/feedback", status_code=204)
@limiter.limit("30/minute")
def rag_feedback(request: Request, body: FeedbackRequest):
    """Store a thumbs up/down. Re-voting on the same answer (same id) updates the vote."""
    if body.rating == 0:
        raise HTTPException(status_code=422, detail="rating must be 1 or -1")
    clip = lambda values: [str(v)[:120] for v in values]  # noqa: E731 - refs are short labels
    params = (
        body.id, body.rating, body.question, body.answer,
        json.dumps(clip(body.citations), ensure_ascii=False), json.dumps(clip(body.source_refs), ensure_ascii=False),
        body.lang, body.mode, body.llm_model, (body.comment or "").strip() or None,
    )
    with get_cursor() as cur:
        cur.execute(_FEEDBACK_UPSERT_SQLITE if use_sqlite() else _FEEDBACK_UPSERT_PG, params)
    logger.info(
        "chat feedback",
        extra={"event": "chat_feedback", "data": {"rating": body.rating, "mode": body.mode, "llm_model": body.llm_model}},
    )
    return Response(status_code=204)


@router.post("/ask")
@limiter.limit("15/minute")
def rag_ask(request: Request, body: AskRequest):
    return ask(body.question, body.lang)


@router.post("/chat")
@limiter.limit("15/minute")
def rag_chat(request: Request, body: ChatRequest):
    history = [{"role": m.role, "content": m.content} for m in body.history]
    return chat(
        body.message,
        body.lang,
        history,
        response_lang=body.response_lang or body.lang,
        include_transliteration=body.include_transliteration,
    )


@router.post("/chat/stream")
@limiter.limit("15/minute")
def rag_chat_stream(request: Request, body: ChatRequest):
    """Same answer as /chat, streamed as NDJSON: progress events while the pipeline runs,
    then {"type": "result", ...}. Lets the client show what is happening during the wait."""
    history = [{"role": m.role, "content": m.content} for m in body.history]
    events: queue.Queue = queue.Queue()

    def run() -> None:
        try:
            result = chat(
                body.message,
                body.lang,
                history,
                response_lang=body.response_lang or body.lang,
                include_transliteration=body.include_transliteration,
                progress=lambda stage, data: events.put({"type": "stage", "stage": stage, **data}),
            )
            events.put({"type": "result", "result": result})
        except Exception as exc:
            logger.exception("Streamed chat failed", extra={"event": "chat_stream_failed"})
            events.put({"type": "error", "status": 503 if isinstance(exc, DatabaseUnavailable) else 500})
        events.put(None)

    threading.Thread(target=run, daemon=True).start()

    def lines():
        while (event := events.get()) is not None:
            yield json.dumps(event, ensure_ascii=False) + "\n"

    return StreamingResponse(
        lines(),
        media_type="application/x-ndjson",
        # Proxies must pass each line through as it's written, not buffer the whole body.
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
