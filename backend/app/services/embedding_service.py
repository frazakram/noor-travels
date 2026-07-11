"""Unified text embeddings: local bge-m3, OpenAI, or Xenova (Next.js /api/embed)."""
from __future__ import annotations

import urllib.request
import json
from functools import lru_cache

from app.core.config import get_settings

MAX_EMBED_CHARS = 6000
_local_model = None


def truncate_text(text: str, max_chars: int = MAX_EMBED_CHARS) -> str:
    return text[:max_chars] if len(text) > max_chars else text


def _provider() -> str:
    return get_settings().embedding_provider.lower()


def use_local_embeddings() -> bool:
    return _provider() == "local"


def use_xenova_embeddings() -> bool:
    return _provider() == "xenova"


def _local_runtime_available() -> bool:
    if not use_local_embeddings():
        return False
    try:
        import importlib.util
        return importlib.util.find_spec("sentence_transformers") is not None
    except Exception:
        return False


@lru_cache(maxsize=1)
def _load_local_model():
    if not _local_runtime_available():
        raise RuntimeError("sentence-transformers not available in this runtime")
    from sentence_transformers import SentenceTransformer
    settings = get_settings()
    print(f"Loading local embedding model: {settings.local_embedding_model} …")
    return SentenceTransformer(settings.local_embedding_model, device="cpu")


def _embed_via_xenova(texts: list[str]) -> list[list[float]]:
    """Call Next.js /api/embed in batches of 32."""
    url = get_settings().embed_url
    results: list[list[float]] = []
    batch_size = 32
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        payload = json.dumps({"texts": batch}).encode()
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
        if "error" in data:
            raise RuntimeError(f"Xenova embed error: {data['error']}")
        results.extend(data["embeddings"])
    return results


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Returns list of float vectors."""
    if not texts:
        return []

    settings = get_settings()
    safe = [truncate_text(t) for t in texts]

    if use_xenova_embeddings():
        return _embed_via_xenova(safe)

    if use_local_embeddings():
        model = _load_local_model()
        vectors = model.encode(
            safe,
            normalize_embeddings=True,
            batch_size=settings.embedding_batch_size,
            show_progress_bar=False,
        )
        return [v.tolist() for v in vectors]

    if _provider() != "openai":
        raise RuntimeError(
            f"Unknown EMBEDDING_PROVIDER '{settings.embedding_provider}' — "
            "expected 'local', 'xenova', or 'openai'."
        )

    from openai import OpenAI
    client = OpenAI(api_key=settings.openai_api_key)
    resp = client.embeddings.create(model=settings.embedding_model, input=safe)
    return [item.embedding for item in resp.data]
