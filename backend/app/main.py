from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, duas, hadith, khutba, quran, quran_audio, rag, recite, salah, tts
from app.core.config import get_settings

settings = get_settings()

_provider = settings.chat_provider.lower()
if _provider not in ("local", "groq", "openai"):
    print(f"WARNING: unknown CHAT_PROVIDER '{settings.chat_provider}' — chat falls back to local templates.")
elif _provider == "groq" and not settings.groq_api_key.strip():
    print("WARNING: CHAT_PROVIDER=groq but GROQ_API_KEY is empty — chat falls back to local templates.")
elif _provider == "openai" and not settings.openai_api_key.strip():
    print("WARNING: CHAT_PROVIDER=openai but OPENAI_API_KEY is empty — chat falls back to local templates.")

app = FastAPI(title="Noor Safar API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(quran.router, prefix="/api/quran", tags=["quran"])
app.include_router(quran_audio.router, prefix="/api/quran/audio", tags=["quran-audio"])
app.include_router(hadith.router, prefix="/api/hadith", tags=["hadith"])
app.include_router(duas.router, prefix="/api/duas", tags=["duas"])
app.include_router(rag.router, prefix="/api/rag", tags=["rag"])
app.include_router(tts.router, prefix="/api/tts", tags=["tts"])
app.include_router(khutba.router, prefix="/api/khutba", tags=["khutba"])
app.include_router(recite.router, prefix="/api/recite", tags=["recite"])
app.include_router(salah.router, prefix="/api/salah", tags=["salah"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])


@app.get("/api/health")
def health():
    settings = get_settings()
    if settings.use_groq_chat:
        chat_provider = "groq"
    elif settings.use_openai_chat:
        chat_provider = "openai"
    else:
        chat_provider = "local"
    return {
        "status": "ok",
        "app": "Noor Safar",
        "chat_provider": chat_provider,
        "embedding_provider": settings.embedding_provider,
    }
