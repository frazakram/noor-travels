from functools import lru_cache
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openai_api_key: str = ""
    groq_api_key: str = ""
    deepgram_api_key: str = ""
    postgres_url: str = ""
    supabase_url: str = ""
    # Read from env OR backend/.env (os.getenv alone misses .env values,
    # since pydantic-settings does not export them to the process env).
    force_sqlite: str = ""
    cors_origins: str = "http://localhost:3000"
    # Signs auth tokens. Set AUTH_SECRET in prod; the fallback derives a
    # stable secret from the DB URL so tokens survive cold starts either way.
    auth_secret: str = ""

    # Chat: "local" (free template), "groq" (free LLM), or "openai" (paid LLM)
    chat_provider: str = "local"
    # Embeddings: "local" (bge-m3), "openai", or "xenova" (calls /api/embed on Next.js)
    embedding_provider: str = "local"
    local_embedding_model: str = "BAAI/bge-m3"
    embedding_batch_size: int = 16
    embedding_model: str = "text-embedding-3-small"
    chat_model: str = "gpt-4o-mini"
    embedding_dimensions: int = 1024
    # URL of the Next.js /api/embed endpoint (auto-derived from VERCEL_URL when empty)
    embed_api_url: str = ""
    # Shared with the Next.js /api/embed route; when set there, requests without it get 401.
    embed_secret: str = ""
    # The /api/embed model that semantic search expects. Vectors are tagged with the model that
    # made them (document_chunks.metadata.embed_model) and only matching rows are searched, so a
    # model switch can never compare vectors from two different models.
    semantic_model: str = "all-MiniLM-L6-v2"
    # Calibrated on English-only passages: correct sources score 0.44-0.98, so 0.50 dropped real
    # hits; noise is bounded by the per-phrase top-k, not by this floor.
    rag_min_similarity: float = 0.40
    rag_retrieval_k: int = 20
    rag_final_k: int = 5
    rag_cache_ttl_hours: int = 168
    # llama-3.1-8b-instant was decommissioned by Groq; gpt-oss-20b is the
    # current fast/cheap tier that still supports response_format=json_object.
    groq_chat_model: str = "openai/gpt-oss-20b"
    # Tried in order when the primary model is removed or rejects a request.
    groq_fallback_models: str = "qwen/qwen3.8-27b,openai/gpt-oss-120b"
    # Question -> retrieval keywords. A different model from answering keeps the two on
    # separate Groq rate-limit budgets; qwen was the most precise and fastest in testing.
    groq_rewrite_models: str = "qwen/qwen3.8-27b,openai/gpt-oss-120b,openai/gpt-oss-20b"

    @property
    def embed_url(self) -> str:
        """Resolved URL for the Xenova /api/embed endpoint."""
        if self.embed_api_url:
            return self.embed_api_url.rstrip("/")
        import os
        vercel_url = os.environ.get("VERCEL_URL", "")
        if vercel_url:
            return f"https://{vercel_url}/api/embed"
        return "http://localhost:3000/api/embed"

    # Legacy alias
    @property
    def rag_top_k(self) -> int:
        return self.rag_retrieval_k

    @property
    def database_url(self) -> str:
        url = self.postgres_url
        if url.count("@") > 1:
            # Password contains @ — rebuild URL safely
            prefix = "postgresql://"
            if not url.startswith(prefix):
                return url
            rest = url[len(prefix) :]
            userinfo, hostpart = rest.rsplit("@", 1)
            user, password = userinfo.split(":", 1)
            return f"{prefix}{user}:{quote_plus(password)}@{hostpart}"
        return url

    @property
    def use_openai_chat(self) -> bool:
        return self.chat_provider.lower() == "openai" and bool(self.openai_api_key.strip())

    @property
    def use_groq_chat(self) -> bool:
        return self.chat_provider.lower() == "groq" and bool(self.groq_api_key.strip())

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
