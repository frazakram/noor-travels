"""Chat history for signed-in users: /api/chats. Turns are saved by /api/rag/chat(/stream)."""

from fastapi import APIRouter, Header, HTTPException, Path, Query, Request, Response
from pydantic import BaseModel, Field

from app.api.auth import current_user_id
from app.core.limiter import limiter
from app.services import chat_history

router = APIRouter()

ConversationId = Path(pattern=chat_history.UUID_RE.pattern)


class UpdateRequest(BaseModel):
    starred: bool | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)


@router.get("")
@limiter.limit("60/minute")
def list_chats(request: Request, q: str = Query(default="", max_length=100), authorization: str | None = Header(default=None)):
    user_id = current_user_id(authorization)
    return {"conversations": chat_history.list_conversations(user_id, q)}


@router.get("/{conversation_id}")
@limiter.limit("60/minute")
def get_chat(request: Request, conversation_id: str = ConversationId, authorization: str | None = Header(default=None)):
    user_id = current_user_id(authorization)
    conversation = chat_history.get_conversation(user_id, conversation_id)
    if not conversation:
        raise HTTPException(404, "Conversation not found")
    return conversation


@router.patch("/{conversation_id}")
@limiter.limit("60/minute")
def update_chat(request: Request, body: UpdateRequest, conversation_id: str = ConversationId, authorization: str | None = Header(default=None)):
    user_id = current_user_id(authorization)
    conversation = chat_history.update_conversation(user_id, conversation_id, body.starred, body.title)
    if not conversation:
        raise HTTPException(404, "Conversation not found")
    return conversation


@router.delete("/{conversation_id}", status_code=204)
@limiter.limit("30/minute")
def delete_chat(request: Request, conversation_id: str = ConversationId, authorization: str | None = Header(default=None)):
    user_id = current_user_id(authorization)
    if not chat_history.delete_conversation(user_id, conversation_id):
        raise HTTPException(404, "Conversation not found")
    return Response(status_code=204)
