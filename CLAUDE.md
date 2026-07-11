# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Noor Safar (نور سفر) — Islamic remembrance, learning, and live khutba translation app. Quran reader, Hadith browser, Duas, RAG chat with citations, prayer times, adhan notifications. India-first, UI in English/Urdu/Hindi. Production: https://noor-travels-chi.vercel.app (GitHub: frazakram/noor-travels).

## Commands

```bash
# Backend (FastAPI, Python 3.12 venv at backend/.venv)
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend (Next.js 16 — must use --webpack, not Turbopack, per dev script)
cd frontend && npm run dev          # dev:clean kills stale next + wipes .next
cd frontend && npm run build        # production build (use to typecheck)
cd frontend && npm run lint

# Backend smoke tests (needs uvicorn running on :8000)
cd backend && .venv/bin/python ingestion/run_all_tests.py

# RAG retrieval quality eval (offline, forces local SQLite, no LLM)
cd backend && .venv/bin/python ingestion/eval_chat.py
```

There is no pytest/jest suite; testing is the two scripts above plus manual verification in the running app.

**Critical rule: never push without testing locally first.** Run the app, verify the change works, then push.

## Architecture

Monorepo deployed as **two Vercel Services** (defined in root `vercel.json`): `frontend/` (Next.js) serves `/`, `backend/` (FastAPI, entrypoint `app.main:app`) serves `/api/*`. Exception: `/api/embed` is a Next.js route (Xenova/transformers.js embeddings in the frontend service). `frontend/lib/api.ts` prefixes requests with `NEXT_PUBLIC_API_URL` (empty in prod — same origin; `http://localhost:8000` locally via `frontend/.env.local`).

### Backend (`backend/`)

- `app/api/` — routers, one per feature: `quran`, `quran_audio`, `hadith`, `hadith_topics`, `duas`, `rag` (chat), `tts`, `khutba` (live transcription), `salah` (prayer times), `auth`. All mounted under `/api/<name>` in `app/main.py`.
- `app/core/config.py` — pydantic-settings `Settings`, reads `backend/.env`. Provider switches live here:
  - `CHAT_PROVIDER`: `local` (template answers) / `groq` (active in prod, llama-3.3-70b) / `openai`
  - `EMBEDDING_PROVIDER`: `local` (bge-m3 via sentence-transformers, ingestion only — needs `requirements-dev.txt`) / `openai` / `xenova` (prod: backend calls the Next.js `/api/embed` route)
- `app/db.py` — **dual-mode DB**: Supabase Postgres (`POSTGRES_URL`) with automatic fallback to SQLite at `backend/data/noor_safar.db`; `FORCE_SQLITE=1` pins SQLite for local dev. Placeholder style differs (`%s` vs `?`) — `get_cursor()` handles it; keep queries compatible with both.
- `app/services/` — RAG pipeline: `query_analyzer`/`query_expansion` (intent, TAFSIR_HINT, thematic clusters) → `retrieval.py` (routes verse/surah lookups to `keyword_search.py`, themes to `hybrid_retriever` keyword+pgvector semantic) → `rag_service.py` (LLM call with last-6-turn session memory, `_validate_citations` filters hallucinated refs) → `answer_validator`. Answers must always cite sources (Surah:Ayah, collection+number) — retrieval-grounded only, no free-form religious answers.
- `ingestion/` — one-off scripts run locally against prod Postgres or local SQLite: `migrate.py` (tables), `fetch_quran/hadith/khutbahs.py`, `seed_duas.py`, `embed_index.py`, `ingest_tafsir.py` (Ibn Kathir, `--resume`). Run with `EMBEDDING_PROVIDER=local`.
- Data lives in `document_chunks` (pgvector) with `source_type` ∈ quran/hadith/dua/tafsir.

### Frontend (`frontend/`)

- Next.js 16 App Router, React 19, Tailwind. Pages: `/` (home dashboard widgets in `components/home/`), `/quran/[surah]` (reader — `SurahClient.tsx`, progressive rendering 18 ayahs at a time), `/quran/listen` (audiobook), `/ask`, `/duas`, `/hadith`, `/khutba`, `/learn-quran` (course + quizzes), `/library`, `/settings`, `/account`.
- `lib/i18n.ts` — all UI strings as an EN/UR/HI translations object; every user-facing string must go through it.
- `lib/native-bridge.ts` — `NoorAndroid` JS bridge for the Android WebView APK (audio playback queue, prayer/hadith alarm scheduling). Guard calls: the bridge only exists inside the APK. The Android Studio project is separate (`~/AndroidStudioProjects/noortravels`, not a git repo).
- Prayer-time stack: `hooks/useSalah.ts` (fetch + timezone-aware midnight refresh) + `lib/salah.ts`, `lib/salah-streak.ts`, `lib/notification-schedule.ts`/`notification-prefs.ts`.
- Audio stack: `hooks/useSurahAudio.ts` + `lib/quran-audio.ts` (web speech + native queue) + `lib/media-session.ts`.
- `scripts/patch-onnx.js` (postinstall) stubs onnxruntime-node with onnxruntime-web so `@huggingface/transformers` runs pure-WASM on Vercel; `next.config.js` keeps it in `serverExternalPackages`. Don't "fix" these away.

### Vercel runtime gotchas (Python serverless)

- WebSockets don't work (frames dropped at edge) — khutba live uses HTTP POST `/api/khutba/live-chunk` with base64 audio in JSON.
- Binary multipart bodies get corrupted — always send audio as base64-in-JSON, never raw multipart.
- No Vercel CLI on this machine — env vars only via the Vercel dashboard, then Redeploy. See `VERCEL_DEPLOY.md` for env var list and one-time Postgres seeding steps.

## Environment

`backend/.env` (never commit) holds `POSTGRES_URL`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `DEEPGRAM_API_KEY`, provider switches. Local dev: `FORCE_SQLITE=1`. Examples in `backend/.env.example`, `frontend/.env.example`, `.env.vercel.example`; `scripts/prepare_vercel_env.py` generates the Vercel import file.
