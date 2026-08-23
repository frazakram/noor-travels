"""Shared per-IP rate limiter for the handful of endpoints that call a paid
external API (LLM, Deepgram STT, edge-tts, embeddings) — without this, a single
client (or a buggy retry loop) can run up real provider costs with no limit.

In-memory storage: Vercel's Python runtime can reuse a warm serverless instance
across several requests, so this still throttles the common case (rapid-fire
abuse against one warm instance), even though counts aren't shared across cold
instances. A shared store (Redis/Upstash) would close that gap but isn't part
of this stack today — this is a pragmatic first line of defense, not a complete
distributed rate limiter.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
