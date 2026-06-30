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

Use `.vercel.env` for Vercel's environment import. It is generated locally and gitignored:

```bash
python3 scripts/prepare_vercel_env.py
```

Important production settings:

- `NEXT_PUBLIC_API_URL=` must stay empty so the frontend uses same-domain `/api` rewrites.
- `FORCE_SQLITE=0` must be used on Vercel.
- `POSTGRES_URL` must point to your hosted Supabase/Postgres database.
- `EMBEDDING_PROVIDER=openai` avoids installing local ML models in serverless.

If deploy fails with a bundle size error (~5 GB), confirm Vercel is **not** using a custom backend `installCommand`, and that `backend/requirements.txt` does **not** list `sentence-transformers`.

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

