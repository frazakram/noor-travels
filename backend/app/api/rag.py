from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.rag_service import ask, chat

router = APIRouter()


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
def rag_ask(body: AskRequest):
    return ask(body.question, body.lang)


@router.post("/chat")
def rag_chat(body: ChatRequest):
    history = [{"role": m.role, "content": m.content} for m in body.history]
    return chat(
        body.message,
        body.lang,
        history,
        response_lang=body.response_lang or body.lang,
        include_transliteration=body.include_transliteration,
    )
