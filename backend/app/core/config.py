from functools import lru_cache
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openai_api_key: str = ""
    deepgram_api_key: str = ""
    postgres_url: str = ""
    supabase_url: str = ""
    cors_origins: str = "http://localhost:3000"

    # Chat: "local" (free, retrieval + theme summaries) or "openai" (paid LLM rephrasing)
    chat_provider: str = "local"
    # Embeddings: "local" (bge-m3, free) or "openai"
    embedding_provider: str = "local"
    local_embedding_model: str = "BAAI/bge-m3"
    embedding_batch_size: int = 16
    embedding_model: str = "text-embedding-3-small"
    chat_model: str = "gpt-4o-mini"
    embedding_dimensions: int = 1024
    rag_min_similarity: float = 0.42
    rag_retrieval_k: int = 20
    rag_final_k: int = 5
    rag_cache_ttl_hours: int = 168

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
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
