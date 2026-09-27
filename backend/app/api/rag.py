import json
import logging
import queue
import threading

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.limiter import limiter
from app.db import DatabaseUnavailable
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
