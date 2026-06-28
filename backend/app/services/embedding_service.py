"""Unified text embeddings: local bge-m3 (default) or OpenAI."""
from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings

MAX_EMBED_CHARS = 6000
_local_model = None


def truncate_text(text: str, max_chars: int = MAX_EMBED_CHARS) -> str:
    return text[:max_chars] if len(text) > max_chars else text


def use_local_embeddings() -> bool:
    return get_settings().embedding_provider.lower() == "local"


@lru_cache(maxsize=1)
def _load_local_model():
    from sentence_transformers import SentenceTransformer

    settings = get_settings()
    print(f"Loading local embedding model: {settings.local_embedding_model} …")
    return SentenceTransformer(settings.local_embedding_model)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Returns list of float vectors."""
    if not texts:
        return []

    settings = get_settings()
    safe = [truncate_text(t) for t in texts]

    if use_local_embeddings():
        model = _load_local_model()
        vectors = model.encode(
            safe,
            normalize_embeddings=True,
            batch_size=settings.embedding_batch_size,
            show_progress_bar=False,
        )
        return [v.tolist() for v in vectors]

    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    resp = client.embeddings.create(model=settings.embedding_model, input=safe)
    return [item.embedding for item in resp.data]
