"""Saved chat conversations for signed-in users: list, open, star, rename, delete.

Turns are saved by the chat endpoints themselves (save_turn), right after the answer is
produced, so history never depends on the client making a second request. Every query is
scoped by user_id: a conversation id from another account behaves as if it did not exist.
"""

import json
import logging
import re
import time

from app.db import get_cursor, use_sqlite

logger = logging.getLogger(__name__)

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
TITLE_MAX = 80
# What a reopened answer needs to look the same: everything the chat UI renders.
_META_KEYS = ("transliteration", "citations", "notice", "confidence", "mode", "llm_model")
_MAX_SOURCES = 12
_SNIPPET_MAX = 800


def _now() -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())


def make_title(question: str) -> str:
    title = " ".join(question.split())
    return title if len(title) <= TITLE_MAX else title[: TITLE_MAX - 1].rstrip() + "…"


def answer_meta(result: dict, response_lang: str) -> dict:
    meta = {k: result[k] for k in _META_KEYS if result.get(k) not in (None, "", [])}
    sources = [
        {"ref": s.get("ref", ""), "type": s.get("type", ""), "snippet": str(s.get("snippet", ""))[:_SNIPPET_MAX], **({"score": s["score"]} if s.get("score") is not None else {})}
        for s in (result.get("sources") or [])[:_MAX_SOURCES]
        if isinstance(s, dict)
    ]
    if sources:
        meta["sources"] = sources
    meta["response_lang"] = response_lang
    return meta


def _json_param() -> str:
    return "%s" if use_sqlite() else "%s::jsonb"


def _load_meta(value) -> dict:
    if isinstance(value, dict):
        return value
    try:
        return json.loads(value or "{}")
    except (TypeError, ValueError):
        return {}


def _owner(cur, conversation_id: str) -> int | None:
    cur.execute("SELECT user_id FROM chat_conversations WHERE id = %s", (conversation_id,))
    row = cur.fetchone()
    return row["user_id"] if row else None


def save_turn(user_id: int, conversation_id: str, question: str, result: dict, response_lang: str, replace_last: bool = False) -> bool:
    """Appends one question and its answer. replace_last swaps out the previous pair (the answer
    regenerated in another language) instead of adding a duplicate question."""
    now = _now()
    with get_cursor() as cur:
        owner = _owner(cur, conversation_id)
        if owner is None:
            cur.execute(
                "INSERT INTO chat_conversations (id, user_id, title, created_at, updated_at) VALUES (%s, %s, %s, %s, %s)",
                (conversation_id, user_id, make_title(question), now, now),
            )
        elif owner != user_id:
            logger.warning("chat history: conversation belongs to another user", extra={"event": "chat_history_denied"})
            return False
        if replace_last:
            cur.execute(
                "SELECT id, role FROM chat_messages WHERE conversation_id = %s ORDER BY id DESC LIMIT 2",
                (conversation_id,),
            )
            last = cur.fetchall()
            if [m["role"] for m in last] == ["assistant", "user"]:
                cur.execute("DELETE FROM chat_messages WHERE id IN (%s, %s)", (last[0]["id"], last[1]["id"]))
        insert = f"INSERT INTO chat_messages (conversation_id, role, content, meta, created_at) VALUES (%s, %s, %s, {_json_param()}, %s)"
        cur.execute(insert, (conversation_id, "user", question, "{}", now))
        cur.execute(insert, (conversation_id, "assistant", result.get("answer", ""), json.dumps(answer_meta(result, response_lang), ensure_ascii=False), now))
        cur.execute("UPDATE chat_conversations SET updated_at = %s WHERE id = %s", (now, conversation_id))
    return True


def _conversation(row: dict) -> dict:
    return {"id": row["id"], "title": row["title"], "starred": bool(row["starred"]), "updated_at": str(row["updated_at"])}


def list_conversations(user_id: int, query: str = "", limit: int = 100) -> list[dict]:
    sql = "SELECT id, title, starred, updated_at FROM chat_conversations WHERE user_id = %s"
    params: list = [user_id]
    if query.strip():
        # Matches the title (the first question) or anything asked later in the conversation.
        sql += (
            " AND (title ILIKE %s OR id IN (SELECT conversation_id FROM chat_messages"
            " WHERE role = 'user' AND content ILIKE %s))"
        )
        pattern = "%" + query.strip().replace("%", "") + "%"
        params += [pattern, pattern]
    sql += " ORDER BY updated_at DESC LIMIT %s"
    params.append(limit)
    with get_cursor() as cur:
        cur.execute(sql, tuple(params))
        return [_conversation(r) for r in cur.fetchall()]


def get_conversation(user_id: int, conversation_id: str) -> dict | None:
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, title, starred, updated_at FROM chat_conversations WHERE id = %s AND user_id = %s",
            (conversation_id, user_id),
        )
        row = cur.fetchone()
        if not row:
            return None
        cur.execute(
            "SELECT role, content, meta FROM chat_messages WHERE conversation_id = %s ORDER BY id",
            (conversation_id,),
        )
        messages = [{"role": m["role"], "content": m["content"], "meta": _load_meta(m["meta"])} for m in cur.fetchall()]
    return {**_conversation(row), "messages": messages}


def update_conversation(user_id: int, conversation_id: str, starred: bool | None, title: str | None) -> dict | None:
    sets, params = [], []
    if starred is not None:
        sets.append("starred = %s")
        params.append(starred if not use_sqlite() else int(starred))
    if title is not None:
        sets.append("title = %s")
        params.append(make_title(title))
    with get_cursor() as cur:
        if sets:
            # Starring or renaming is not activity: updated_at keeps the conversation's place.
            cur.execute(
                f"UPDATE chat_conversations SET {', '.join(sets)} WHERE id = %s AND user_id = %s",
                (*params, conversation_id, user_id),
            )
        cur.execute(
            "SELECT id, title, starred, updated_at FROM chat_conversations WHERE id = %s AND user_id = %s",
            (conversation_id, user_id),
        )
        row = cur.fetchone()
    return _conversation(row) if row else None


def delete_conversation(user_id: int, conversation_id: str) -> bool:
    with get_cursor() as cur:
        if _owner(cur, conversation_id) != user_id:
            return False
        # SQLite doesn't enforce ON DELETE CASCADE without PRAGMA foreign_keys.
        cur.execute("DELETE FROM chat_messages WHERE conversation_id = %s", (conversation_id,))
        cur.execute("DELETE FROM chat_conversations WHERE id = %s AND user_id = %s", (conversation_id, user_id))
    return True


def delete_all_for_user(cur, user_id: int) -> None:
    cur.execute(
        "DELETE FROM chat_messages WHERE conversation_id IN (SELECT id FROM chat_conversations WHERE user_id = %s)",
        (user_id,),
    )
    cur.execute("DELETE FROM chat_conversations WHERE user_id = %s", (user_id,))
