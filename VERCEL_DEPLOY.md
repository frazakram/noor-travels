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

## 3. Deploy

After importing env vars in Vercel, deploy from the dashboard.

If using the Vercel CLI locally:

```bash
npm i -g vercel
vercel login
vercel env pull
vercel --prod
```

## 4. Verify

After deploy, check:

- `/`
- `/api/health`
- `/quran`
- `/khutba`

