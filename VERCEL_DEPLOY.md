# Vercel Deployment

This project deploys as two Vercel Services from one repo:

- `frontend` — Next.js app at `/`
- `backend` — FastAPI app behind `/api/*`

## 1. Project Settings

In Vercel, import `frazakram/noor-travels` and keep:

- Project name: `noor-travels`
- Application preset: `Services`
- Root directory: repository root

The root `vercel.json` defines both services and routes `/api/*` to the backend.

## 2. Environment Variables

See `.env.vercel.example` for the full list. **Minimum required for Quran, Hadith, and Chat:**

| Variable | Required | Notes |
|----------|----------|-------|
| `POSTGRES_URL` | **Yes** | Supabase Postgres URI |
| `FORCE_SQLITE` | **Yes** | Must be `0` |
| `CORS_ORIGINS` | **Yes** | Include `https://noor-travels-chi.vercel.app` |
| `NEXT_PUBLIC_API_URL` | **Yes** | Leave **empty** |
| `EMBEDDING_PROVIDER` | **Yes** | `openai` |
| `OPENAI_API_KEY` | For chat | Set `CHAT_PROVIDER=openai` for best answers |
| `DEEPGRAM_API_KEY` | Optional | Khutba live transcription only |

Generate from local `.env` files:

```bash
python3 scripts/prepare_vercel_env.py
```

Import `.vercel.env` in Vercel → Settings → Environment Variables, then **Redeploy**.

### Database setup (one-time — without this Quran stays on "Loading")

Vercel has **no SQLite file**. You must use **Supabase Postgres** and seed it from your laptop:

```bash
cd backend
export POSTGRES_URL="postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres"
export FORCE_SQLITE=0

# 1. Create tables
python ingestion/migrate.py

# 2. Load Quran, Hadith, Duas (takes a few minutes)
python ingestion/fetch_quran.py
python ingestion/fetch_hadith.py
python ingestion/seed_duas.py
python ingestion/fetch_khutbahs.py --from-json

# 3. Embeddings for chat (needs OPENAI_API_KEY in backend/.env)
export EMBEDDING_PROVIDER=openai
python ingestion/embed_index.py
```

Verify: open `https://noor-travels-chi.vercel.app/api/health` — should return `"status":"ok"`.
Then open `/api/quran/surahs` — should return a JSON list of surahs.

Important production settings:

- `NEXT_PUBLIC_API_URL=` must stay empty so the frontend uses same-domain `/api` rewrites.
- `FORCE_SQLITE=0` must be used on Vercel.
- `POSTGRES_URL` must point to your hosted Supabase/Postgres database.
- `EMBEDDING_PROVIDER=openai` avoids installing local ML models in serverless.

If deploy fails with a bundle size error (~5 GB):

1. Redeploy the **latest** commit (must include slim `backend/requirements.txt` without `sentence-transformers`).
2. In Vercel → Project Settings → Build, clear any custom **Install Command** for the backend.
3. Confirm `excludeFiles` lives under the `backend` service in `vercel.json` (top-level `functions` is ignored in Services mode).

## 3. Python dependencies

Vercel installs `backend/requirements.txt` (slim, no local ML models).

For local development with local embeddings:

```bash
cd backend
pip install -r requirements-dev.txt
```

Production must keep `EMBEDDING_PROVIDER=openai` so the backend does not need `sentence-transformers`.

## 4. Deploy

After importing env vars in Vercel, deploy from the dashboard.

If using the Vercel CLI locally:

```bash
npm i -g vercel
vercel login
vercel env pull
vercel --prod
```

## 5. Verify

After deploy, check:

- `/`
- `/api/health`
- `/quran`
- `/khutba`

