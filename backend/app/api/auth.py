"""Email/password auth with HMAC-signed tokens.

Passwords are hashed with stdlib scrypt and tokens are compact
HMAC-SHA256 signatures — no extra dependencies in the serverless bundle.
The Android app wraps the same site, so this works there unchanged.
"""

import base64
import hashlib
import hmac
import json
import os
import re
import time

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.db import get_cursor

router = APIRouter()

TOKEN_TTL_SECONDS = 90 * 24 * 3600
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SCRYPT_N, SCRYPT_R, SCRYPT_P = 16384, 8, 1


def _secret() -> bytes:
    settings = get_settings()
    if settings.auth_secret.strip():
        return settings.auth_secret.strip().encode()
    # Stable fallback: derived from the DB URL (which contains a password),
    # so tokens stay valid across serverless cold starts without extra config.
    return hashlib.sha256(f"noor-auth:{settings.postgres_url}".encode()).digest()


# ── Password hashing ────────────────────────────────────────────────────


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(
        password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=32
    )
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt_hex, digest_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        digest = hashlib.scrypt(
            password.encode(), salt=bytes.fromhex(salt_hex), n=int(n), r=int(r), p=int(p), dklen=32
        )
        return hmac.compare_digest(digest, bytes.fromhex(digest_hex))
    except Exception:
        return False


# ── Tokens ──────────────────────────────────────────────────────────────


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def issue_token(user_id: int) -> str:
    payload = _b64(json.dumps({"uid": user_id, "exp": int(time.time()) + TOKEN_TTL_SECONDS}).encode())
    sig = _b64(hmac.new(_secret(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def verify_token(token: str) -> int | None:
    try:
        payload_b64, sig = token.split(".")
        expected = _b64(hmac.new(_secret(), payload_b64.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(_unb64(payload_b64))
        if payload.get("exp", 0) < time.time():
            return None
        return int(payload["uid"])
    except Exception:
        return None


def current_user_id(authorization: str | None) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Please sign in")
    user_id = verify_token(authorization.removeprefix("Bearer ").strip())
    if user_id is None:
        raise HTTPException(401, "Session expired — please sign in again")
    return user_id


def _public_user(row: dict) -> dict:
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["display_name"],
        "lang": row["preferred_lang"],
    }


# ── Endpoints ───────────────────────────────────────────────────────────


class SignupRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default="", max_length=80)
    lang: str = Field(default="en", max_length=5)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class ProgressRequest(BaseModel):
    progress: dict


@router.post("/signup")
def signup(body: SignupRequest):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Please enter a valid email address")
    lang = body.lang if body.lang in ("en", "ur", "hi") else "en"

    with get_cursor() as cur:
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            raise HTTPException(409, "An account with this email already exists — try signing in")
        cur.execute(
            """
            INSERT INTO users (email, password_hash, display_name, preferred_lang)
            VALUES (%s, %s, %s, %s)
            """,
            (email, hash_password(body.password), body.name.strip(), lang),
        )
        cur.execute("SELECT * FROM users WHERE email = %s", (email,))
        row = cur.fetchone()
    return {"token": issue_token(row["id"]), "user": _public_user(row)}


@router.post("/login")
def login(body: LoginRequest):
    email = body.email.strip().lower()
    with get_cursor() as cur:
        cur.execute("SELECT * FROM users WHERE email = %s", (email,))
        row = cur.fetchone()
    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "Email or password is incorrect")
    with get_cursor() as cur:
        cur.execute("UPDATE users SET last_login_at = %s WHERE id = %s", (_now(), row["id"]))
    return {"token": issue_token(row["id"]), "user": _public_user(row)}


@router.get("/me")
def me(authorization: str | None = Header(default=None)):
    user_id = current_user_id(authorization)
    with get_cursor() as cur:
        cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(401, "Account no longer exists")
    return {"user": _public_user(row)}


@router.get("/progress")
def get_progress(authorization: str | None = Header(default=None)):
    user_id = current_user_id(authorization)
    with get_cursor() as cur:
        cur.execute("SELECT progress, updated_at FROM user_learn_progress WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
    if not row:
        return {"progress": None, "updated_at": None}
    try:
        progress = json.loads(row["progress"])
    except (TypeError, ValueError):
        progress = None
    return {"progress": progress, "updated_at": str(row["updated_at"])}


@router.put("/progress")
def put_progress(body: ProgressRequest, authorization: str | None = Header(default=None)):
    user_id = current_user_id(authorization)
    raw = json.dumps(body.progress, ensure_ascii=False)
    if len(raw) > 200_000:
        raise HTTPException(413, "Progress payload too large")
    with get_cursor() as cur:
        cur.execute("SELECT user_id FROM user_learn_progress WHERE user_id = %s", (user_id,))
        if cur.fetchone():
            cur.execute(
                "UPDATE user_learn_progress SET progress = %s, updated_at = %s WHERE user_id = %s",
                (raw, _now(), user_id),
            )
        else:
            cur.execute(
                "INSERT INTO user_learn_progress (user_id, progress) VALUES (%s, %s)",
                (user_id, raw),
            )
    return {"ok": True}


def _now() -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())
