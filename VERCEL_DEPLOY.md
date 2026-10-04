# Vercel Deployment

One repo, two Vercel Services (root `vercel.json`):

- `frontend` — Next.js at `/` (also serves `/api/embed`)
- `backend` — FastAPI at `/api/*`, entrypoint `app.main:app`

Functions run in **`sin1` (Singapore)** — next to the Supabase database (`ap-southeast-1`)
and close to users in India. Moving the region away from the database puts every query
on a ~230 ms round trip.

Every push to `main` deploys to production. If a push never gets a Vercel status on
GitHub, use Vercel → Deployments → ⋯ → **Create Deployment** with `main`.

## Environment variables

Set in Vercel → Settings → Environment Variables (then Redeploy). `backend/app/core/config.py`
is the source of truth for backend settings.

| Variable | Needed | Value / notes |
|---|---|---|
| `POSTGRES_URL` | **Yes** | Supabase pooler URI (port 6543). With it set, the backend never falls back to SQLite; an unreachable DB returns 503. |
| `CORS_ORIGINS` | **Yes** | `https://noor-travels-chi.vercel.app` |
| `CHAT_PROVIDER` | **Yes** | `groq` |
| `GROQ_API_KEY` | **Yes** | Chat, khutba translation, deep health check |
| `DEEPGRAM_API_KEY` | **Yes** | Khutba Live, Recite, TTS fallback |
| `EMBEDDING_PROVIDER` | **Yes** | `xenova` — the backend calls the frontend's `/api/embed` (MiniLM, 384 dims, matching `document_chunks.embedding vector(384)`). Do **not** use `openai` (1536 dims). |
| `AUTH_SECRET` | **Yes** | Long random string that signs login tokens. Without it tokens are derived from `POSTGRES_URL`, so rotating the DB password signs everyone out (a startup warning is logged). |
| `EMBED_SECRET` | Recommended | Long random string; set the **same value** for frontend and backend. `/api/embed` then rejects callers without it. |
| `GROQ_CHAT_MODEL` | Optional | Default `openai/gpt-oss-20b` |
| `GROQ_FALLBACK_MODELS` | Optional | Comma list tried when a model is removed or rate-limited. Default `qwen/qwen3.8-27b,openai/gpt-oss-120b` |
| `OPENAI_API_KEY` | Optional | Only if `CHAT_PROVIDER=openai` |
| `EMBED_API_URL` | Optional | Defaults to `https://$VERCEL_URL/api/embed` |
| `NEXT_PUBLIC_API_URL` | Leave **empty** | Frontend then calls same-origin `/api` |
| `NEXT_PUBLIC_SITE_URL` | Optional | Canonical origin for sitemap/OG; defaults to the production URL |

Never set `FORCE_SQLITE` on Vercel (it's for local dev only).

## Monitoring

- `/api/health` — shallow, always fast.
- `/api/health/deep` — real DB query + 1-token LLM call; returns 503 when either is broken.
  Point an uptime monitor (UptimeRobot, Better Stack) at it every 5 minutes with email alerts.
  This is what catches a decommissioned Groq model or a DB outage.
- Logs are JSON lines; filter on `event` (`chat_degraded`, `llm_fallback`, `llm_model_failed`,
  `semantic_degraded`, `db_unavailable`, `health_failed`, `config_warning`).
- Every chat answer logs one `chat_answer` line: `mode`, `llm_model` (the model that actually
  answered — not `openai/gpt-oss-20b` means a fallback), `cached`, `refused`, `sources`,
  `citations`, `total_ms` and per-step `rewrite_ms` / `retrieve_ms` / `answer_ms`. No question
  text, only `q_fingerprint` to count repeats. Refusal rate = `refused:true` / all `chat_answer`.

## Database

Schema lives in `backend/migrations/` (each file has a `_sqlite` twin). Seed a fresh database
from a laptop:

```bash
cd backend
export POSTGRES_URL="postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres"
unset FORCE_SQLITE

python ingestion/migrate.py                 # base tables (001, 003)
# Later migrations are applied by hand, in order, once each (006 re-run would wipe embeddings):
#   psql "$POSTGRES_URL" -f migrations/00N_name.sql   for 002, 004–011
python ingestion/fetch_quran.py
python ingestion/fetch_hadith.py
python ingestion/seed_duas.py
python ingestion/fetch_khutbahs.py --from-json

# Semantic search vectors: run `npm run dev` in frontend/ (same /api/embed code as prod), then
# ~40 min; resumable, replaces rows in place. Check with ingestion/eval_semantic.py.
EMBEDDING_PROVIDER=xenova EMBED_TIMEOUT_S=120 \
  EMBED_API_URL=http://localhost:3001/api/embed \
  python ingestion/embed_index.py
```

### Backups

Quran, hadith, duas and tafsir can be re-ingested with the commands above. The only data that
can't be recreated is user accounts: `users`, `user_learn_progress`, `user_preferences`.

- Enable Supabase's scheduled backups (Project → Database → Backups) if the plan allows it.
- Either way, keep an off-site copy of the account tables:

```bash
pg_dump "$POSTGRES_URL" --data-only \
  -t users -t user_learn_progress -t user_preferences \
  > "noor-accounts-$(date +%F).sql"
```

## Python dependencies

Vercel installs from `backend/pyproject.toml`; the local venv uses `backend/requirements.txt`.
Add every new package to **both** — `python backend/scripts/check_deps.py` (also in CI) fails when
they drift. Never import an optional/heavy package at module scope in a router: `app/main.py`
imports every router, so one failed import takes down the whole API.

## Verify a deploy

- `/api/health/deep` → `"status": "ok"`
- `/`, `/quran`, `/hadith`, `/library`, `/khutba` render
- `/app-version.json` matches the latest GitHub release (see `CLAUDE.md`, Android APK releases)
