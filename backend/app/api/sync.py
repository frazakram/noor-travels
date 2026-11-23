"""Sync of personal progress across a signed-in user's devices.

Each namespace (quran-bookmarks, salah-streak, …) is a map of items with a timestamp each:
    {"items": {"2:255": {"v": {...}, "t": 1792000000000}, "3:1": {"t": 1792000000500, "d": 1}}}
`d` marks a deletion (a tombstone), so removing a bookmark on one device removes it everywhere
instead of another device bringing it back. Merging is per item and the newest `t` wins, so two
devices editing different items never lose each other's changes. The client keeps the same merge
(frontend/lib/progress-sync-core.ts); keep the two in step.

Cheap on the wire: a device sends only the items it changed, and a pull names the revision it
already has per namespace, so unchanged namespaces aren't sent back.
"""
import json
import time

from fastapi import APIRouter, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.api.auth import current_user_id
from app.core.limiter import limiter
from app.db import get_cursor, use_sqlite

router = APIRouter()

NAMESPACES = (
    "quran-bookmarks", "quran-last-read", "hadith-favorites",
    "dhikr-bookmarks", "dhikr-progress", "salah-streak", "hifz",
)
MAX_ITEMS = 5000  # per namespace; beyond it the oldest items are dropped
MAX_PUSH_ITEMS = 2000
MAX_DOC_BYTES = 1024 * 1024
MAX_ID_LEN = 120
TOMBSTONE_DAYS = 180


class SyncItem(BaseModel):
    v: object | None = None
    t: int = Field(ge=0)
    d: int | None = Field(default=None, ge=1, le=1)


class SyncPush(BaseModel):
    items: dict[str, SyncItem] = Field(default_factory=dict)


def merge(*docs: dict, now_ms: int | None = None) -> dict:
    """Per item, the larger `t` wins; on a tie a deletion wins (an edit and a delete in the same
    millisecond must not resurrect the item). Tombstones older than TOMBSTONE_DAYS are dropped,
    and past MAX_ITEMS the oldest items go."""
    now_ms = now_ms if now_ms is not None else int(time.time() * 1000)
    cutoff = now_ms - TOMBSTONE_DAYS * 86_400_000
    out: dict[str, dict] = {}
    for doc in docs:
        for key, item in (doc.get("items") or {}).items():
            cur = out.get(key)
            if cur is None or item["t"] > cur["t"] or (item["t"] == cur["t"] and item.get("d") and not cur.get("d")):
                out[key] = item
    kept = {k: v for k, v in out.items() if not (v.get("d") and v["t"] < cutoff)}
    if len(kept) > MAX_ITEMS:
        kept = dict(sorted(kept.items(), key=lambda kv: kv[1]["t"], reverse=True)[:MAX_ITEMS])
    return {"items": kept}


def parse_revs(raw: str | None) -> dict[str, int]:
    """'quran-bookmarks:3,hifz:7' -> {'quran-bookmarks': 3, 'hifz': 7}; junk is ignored."""
    out: dict[str, int] = {}
    for part in (raw or "").split(","):
        ns, _, rev = part.partition(":")
        if ns in NAMESPACES and rev.isdigit():
            out[ns] = int(rev)
    return out


@router.get("")
def pull(authorization: str | None = Header(default=None), revs: str | None = Query(default=None, max_length=1000)):
    """Every namespace whose revision differs from the one the device already has."""
    user_id = current_user_id(authorization)
    known = parse_revs(revs)
    with get_cursor() as cur:
        cur.execute("SELECT namespace, rev, doc FROM user_sync_docs WHERE user_id = %s", (user_id,))
        rows = cur.fetchall()
    return {
        "namespaces": {
            r["namespace"]: {"rev": r["rev"], "items": json.loads(r["doc"]).get("items", {})}
            for r in rows
            if r["namespace"] in NAMESPACES and known.get(r["namespace"]) != r["rev"]
        }
    }


@router.put("/{namespace}")
@limiter.limit("60/minute")
def push(request: Request, namespace: str, body: SyncPush, authorization: str | None = Header(default=None)):
    """Merges the device's changed items into the stored document. Returns the revision before
    and after, so a device that held `base` knows it now holds `rev` without downloading it."""
    user_id = current_user_id(authorization)
    if namespace not in NAMESPACES:
        raise HTTPException(404, "Unknown sync namespace")
    if len(body.items) > MAX_PUSH_ITEMS or any(len(k) > MAX_ID_LEN for k in body.items):
        raise HTTPException(413, "Too many or too long items")
    incoming = {"items": {k: v.model_dump(exclude_none=True) for k, v in body.items.items()}}
    with get_cursor() as cur:
        lock = "" if use_sqlite() else " FOR UPDATE"  # two devices pushing at once must not overwrite each other
        cur.execute(f"SELECT rev, doc FROM user_sync_docs WHERE user_id = %s AND namespace = %s{lock}", (user_id, namespace))
        row = cur.fetchone()
        base = row["rev"] if row else 0
        merged = merge(json.loads(row["doc"]) if row else {"items": {}}, incoming)
        raw = json.dumps(merged, ensure_ascii=False, separators=(",", ":"))
        if len(raw.encode("utf-8")) > MAX_DOC_BYTES:
            raise HTTPException(413, "Sync document too large")
        now = "CURRENT_TIMESTAMP" if use_sqlite() else "NOW()"
        if row:
            cur.execute(
                f"UPDATE user_sync_docs SET doc = %s, rev = rev + 1, updated_at = {now} WHERE user_id = %s AND namespace = %s",
                (raw, user_id, namespace),
            )
        else:
            cur.execute("INSERT INTO user_sync_docs (user_id, namespace, doc, rev) VALUES (%s, %s, %s, 1)", (user_id, namespace, raw))
    return {"base": base, "rev": base + 1}
