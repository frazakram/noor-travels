# Noor Safar — Project Plan

> Islamic remembrance, learning, and live khutba translation for travelers and non-Arabic speakers.  
> **Audience:** India-first · **UI:** English / Urdu / Hindi · **Brand:** Noor Safar (نور سفر)

---

## 1. Idea Assessment

### Strengths

| Aspect | Why it matters |
|--------|----------------|
| **Real, felt pain** | Millions pray and attend khutba without understanding Arabic. Travel amplifies disconnection from familiar imams and languages. |
| **Clear user segments** | Non-Arabic readers, Arabic readers without comprehension, khutba listeners — each maps to a feature. |
| **RAG fits sacred text** | Quran translations and Hadith corpora are structured, citable, and benefit from retrieval + grounded answers (not free-form hallucination). |
| **Differentiation** | Most apps do Quran reading or generic translation. Few combine **travel context + remembrance + live sermon translation** in one product. |
| **Python backend** | Strong ecosystem for RAG (LangChain/LlamaIndex), speech (Whisper/faster-whisper), and translation (NLLB, MarianMT, cloud APIs). |

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Live khutba latency** | Chunk audio in 3–5s windows; show partial transcript; set user expectation ("~5s delay"). |
| **Religious accuracy** | RAG answers must **always cite source** (Surah:Ayah, Hadith collection + number). No uncited fatwa-style answers. |
| **Hallucination** | Strict retrieval-only mode for Quran/Hadith Q&A; LLM only rephrases retrieved text. |
| **Copyright on translations** | Use only openly licensed or user-provided texts; document sources in `DATA_SOURCES.md` internally (not a separate user-facing file). |
| **Backend on Vercel** | Vercel hosts **frontend only**. Python API deploys separately (Railway / Render / Fly.io). WebSockets for live audio need a long-running server. |

### Verdict

**Strong idea with a clear niche.** Start with **Quran + Hadith RAG** (shippable, testable, high value). Add **live khutba translation** as Phase 2 once audio pipeline is validated. Do not launch everything at once.

---

## 2. Product Scope (MVP → v1)

### Phase 1 — Core Web App (MVP)

1. **Quran Explorer**
   - Browse by Surah / Juz / Ayah
   - Arabic text + side-by-side translation (English / Urdu toggle)
   - Tap ayah → hear recitation (stream from licensed audio API or bundled URLs)

2. **Remembrance While Traveling**
   - Curated travel duas (from provided sources, not LLM-generated)
   - "Ayah of the moment" — user picks topic (patience, gratitude, fear) → RAG retrieves relevant ayat with translation
   - Bookmark ayat / duas for offline reference later (Android phase)

3. **Ask with Sources (RAG)**
   - User asks: *"What does Allah say about travel?"*
   - System retrieves matching ayat + hadith → returns answer **with citations only**
   - Languages: English and Urdu responses

4. **Hadith Search**
   - Search by keyword, collection, narrator
   - Full hadith text + translation + reference

### Phase 2 — Live Khutba Translation

5. **Live Audio Translation**
   - User opens "Khutba Mode" → grants microphone access
   - Captures ambient audio (imam's voice via phone mic)
   - Pipeline: Arabic STT → translate → display rolling transcript in English/Urdu
   - Optional: highlight if retrieved Quran/Hadith quote detected in speech

### Phase 3 — Android App

6. Reuse same REST + WebSocket API from Android Studio (Kotlin)
7. Offline: cached bookmarks, downloaded surahs, optional on-device STT later

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 14 + TypeScript) → Vercel              │
│  - Quran UI, RAG chat, Khutba live view                     │
│  - Tailwind + clean minimal Islamic aesthetic               │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / WSS
┌──────────────────────────▼──────────────────────────────────┐
│  Backend (Python FastAPI) → Railway / Render / Fly.io       │
│  ├── /api/quran          — surah, ayah, search               │
│  ├── /api/hadith         — search, by id                     │
│  ├── /api/rag/ask        — grounded Q&A with citations       │
│  ├── /api/duas           — travel remembrance list           │
│  └── /ws/khutba          — live audio stream in/out          │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  PostgreSQL          Qdrant /            Redis
  (metadata,          pgvector            (cache,
   users,              (embeddings)         sessions)
   bookmarks)
        │
        ▼
  Ingestion Pipeline (Python scripts)
  - Fetch Quran/Hadith from your URLs
  - Chunk, embed, index
  - Idempotent re-run on source updates
```

### Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | Next.js 14, TypeScript, Tailwind | Vercel-native, fast, clean UI |
| API | FastAPI, Pydantic v2, Uvicorn | Async, WebSocket support, Python ecosystem |
| RAG orchestration | LangChain or LlamaIndex | Mature retrieval + citation patterns |
| Embeddings | `multilingual-e5-large` or OpenAI `text-embedding-3-small` | Good Arabic + English + Urdu |
| Vector DB | Qdrant (Docker) or pgvector | Self-hosted, no vendor lock-in |
| LLM (rephrase only) | OpenAI GPT-4o-mini or local Ollama | Only formats retrieved chunks; strict prompt |
| STT (khutba) | **Deepgram Nova-3 Arabic** (`language=ar`) | Production Arabic STT, no GPU needed |
| Khutba translation | **OpenAI GPT-4o-mini** (AR → EN + UR) | Balanced cost/quality; ~$0.01/khutba |
| Quran audio | Quran Foundation Content API | Real recitations from quran.com |
| DB | PostgreSQL 16 | Relational data + optional pgvector |
| Monorepo layout | `backend/` + `frontend/` | Clear separation |

### RAG Design (No Hallucination)

```
User question
    → Embed query
    → Retrieve top-k chunks (Quran translations, Hadith, Tafsir if provided)
    → Filter by min similarity score
    → If no chunks above threshold → "I could not find a cited source."
    → Else LLM prompt: "Answer ONLY using these sources. Cite Surah:Ayah or Hadith ref."
    → Return structured JSON: { answer, citations[] }
```

---

## 4. Data Directory — Where to Paste Your Files

```
data/
├── sources/                    ← YOU paste manual files here
│   ├── quran/                  ← Optional overrides (if not using API fetch)
│   │   └── *.json              ← Custom Quran dumps only if you have them
│   ├── hadith/
│   │   └── bukhari/            ← Paste Bukhari files here
│   │       └── *.json          ← e.g. bukhari.json from hadith-json repo
│   └── misc/
│       └── duas/               ← Travel duas, dhikr lists (JSON or TXT)
│           └── travel-duas.json
├── raw/                        ← Auto-downloaded by ingestion (gitignored)
└── processed/                  ← Embedded chunks for RAG (gitignored)
```

### What you need to provide vs what we auto-fetch

| Data | Action |
|------|--------|
| **Quran** (Arabic + Sahih International + Jalandhry + roman) | **Auto-fetched** from [Quran Foundation API](https://api-docs.quran.foundation/) (quran.com). You only paste files in `data/sources/quran/` if you have a custom dump. |
| **Hadith Bukhari** | **Paste** `bukhari.json` into `data/sources/hadith/bukhari/` — download from [hadith-json v1.2.0](https://github.com/AhmedBaset/hadith-json/tree/v1.2.0/db/by_book/the_9_books) |
| **Travel duas / misc** | **Paste** your JSON/TXT into `data/sources/misc/duas/` |
| **Tafsir** | Not in v1 |

### Expected file formats

**Hadith** (`data/sources/hadith/bukhari/bukhari.json`):
```json
{
  "id": 1,
  "idInBook": 1,
  "chapterId": 1,
  "bookId": 1,
  "arabic": "حَدَّثَنَا ...",
  "english": { "narrator": "...", "text": "..." }
}
```

**Duas** (`data/sources/misc/duas/travel-duas.json`):
```json
[
  {
    "id": "travel-1",
    "title_en": "Dua for travel",
    "title_ur": "سفر کی دعا",
    "title_hi": "यात्रा की दुआ",
    "arabic": "سُبْحَانَ ...",
    "transliteration": "Subhanal-ladhi...",
    "translation_en": "...",
    "translation_ur": "...",
    "translation_hi": "...",
    "source": "Sahih Bukhari / Hisnul Muslim"
  }
]
```

---

## 5. Repository Structure

```
new-pj/
├── PLAN.md                 # This file
├── data/                   # See section 4
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/            # routes: quran, hadith, rag, duas, ws
│   │   ├── services/       # rag, stt, translation
│   │   ├── models/         # SQLAlchemy / Pydantic schemas
│   │   └── core/           # config, deps
│   ├── ingestion/
│   │   ├── ingest_quran.py
│   │   ├── ingest_hadith.py
│   │   └── embed_index.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/                # Next.js app router
│   ├── components/
│   └── package.json
├── data/                   # gitignored raw downloads
└── docker-compose.yml      # postgres, qdrant, redis (local dev)
```

---

## 6. UI Pages (Clean & Minimal)

| Route | Purpose |
|-------|---------|
| `/` | Home — quick access: Quran, Ask, Khutba, Travel Duas |
| `/quran` | Surah list → ayah view with AR + EN/UR toggle |
| `/quran/[surah]/[ayah]` | Single ayah deep link |
| `/ask` | RAG chat with citation cards |
| `/hadith` | Search + detail view |
| `/duas` | Travel remembrance collection |
| `/khutba` | Live translation view (Phase 2) |
| `/settings` | Language preference (EN / UR) |

**Design direction:** Calm palette (deep green, cream, gold accents), large readable Arabic typography (Amiri / Scheherazade), mobile-first.

---

## 7. Data Ingestion (Real Data Only)

### Quran

- Source: URL/API you provide (e.g. Tanzil, Quran.com API, or JSON dump)
- Store per ayah: `surah`, `ayah`, `arabic`, `translation_en`, `translation_ur`, `juz`
- Embed: `arabic + translation` combined chunk per ayah

### Hadith

- Source: URLs you provide (Sunnah.com export, hadith-json repos, etc.)
- Store: `collection`, `book`, `hadith_number`, `arabic`, `english`, `urdu` (if available)
- Embed per hadith with metadata for citation

### Duas / Travel

- Curated static JSON from authenticated sources you approve (not LLM-generated)

### Re-ingestion

- Scripts are idempotent: hash source file → skip if unchanged
- Version tag on each index build

---

## 8. Live Khutba Pipeline (Phase 2)

```
Browser MediaRecorder (webm/opus chunks every 8–10s)
    → WebSocket → FastAPI (Railway)
    → Deepgram Nova-3 Arabic STT (language=ar)
    → OpenAI GPT-4o-mini → { english, urdu } JSON
    → WebSocket push → UI dual-column transcript
```

**Latency target:** ~10 seconds (acceptable per your requirement).  
**Deepgram:** Use monolingual Arabic (`ar`), not `language=multi` — multi mode covers Hindi/English but **not Arabic**. Nova-3 Arabic supports MSA + regional dialects ([Deepgram Arabic STT](https://deepgram.com/product/speech-to-text/arabic)).

**Privacy:** Audio not stored by default; optional user opt-in for improvement.

---

## 9. Deployment

| Component | Platform |
|-----------|----------|
| Frontend | **Vercel** (Next.js) |
| Backend (Python FastAPI) | **Railway** free tier — Vercel cannot run long-lived Python WebSockets |
| PostgreSQL + pgvector | **Supabase** |
| Embeddings / RAG vectors | **Supabase pgvector** (no separate Qdrant needed) |
| Secrets | `.env` — never committed |

**You need API keys:**
1. [Quran Foundation](https://api-docs.quran.foundation/request-access/) — client ID + secret (for quran.com data)
2. `OPENAI_API_KEY` — RAG + khutba translation
3. `DEEPGRAM_API_KEY` — khutba STT (free $200 credit on signup)

Android app later points to same production API URL.

---

## 10. Build Order (Execution Sequence)

### Week 1 — Foundation
- [ ] Monorepo scaffold: FastAPI + Next.js
- [ ] Docker Compose: Postgres + Qdrant
- [ ] Config + health endpoints
- [ ] Ingestion scripts (once you provide data URLs)

### Week 2 — Quran + Hadith (read-only)
- [ ] Quran browse API + frontend
- [ ] Hadith search API + frontend
- [ ] Translation language toggle

### Week 3 — RAG
- [ ] Embed + index all corpora
- [ ] `/api/rag/ask` with citation-only responses
- [ ] Ask UI with source cards

### Week 4 — Polish + Deploy
- [ ] Travel duas page
- [ ] Bookmarks (DB)
- [ ] Deploy backend + frontend
- [ ] End-to-end test on real data

### Week 5+ — Khutba Live
- [ ] WebSocket audio endpoint
- [ ] Deepgram STT + OpenAI translation
- [ ] Khutba UI (English + Urdu columns)

---

## 11. Locked Decisions (Your Answers)

| Decision | Choice |
|----------|--------|
| Quran source | **Al Quran Cloud API** (free, no key) — same texts as quran.com editions |
| English translation | Sahih International |
| Urdu translation | Fateh Muhammad Jalandhry |
| Roman Arabic | Yes (transliteration from API) |
| Hadith v1 | Sahih al-Bukhari only |
| Tafsir | Not in v1 |
| UI languages | English / Urdu / Hindi (user-selectable) |
| Khutba output | English + Urdu (both shown) |
| Audience | India-first |
| LLM | OpenAI GPT-4o-mini |
| Khutba STT | Deepgram Nova-3 Arabic |
| Khutba translation | OpenAI GPT-4o-mini (free fallback: Argos Translate offline) |
| Hosting | Vercel (frontend) + Supabase (DB/pgvector) + Railway (Python API) |
| Khutba input | Phone mic only |
| Latency | ~10s acceptable |
| GPU | None — Deepgram handles STT in cloud |
| Brand | **Noor Safar** |
| Disclaimer | *"For learning and remembrance. Not a source of fatwa. Verify with qualified scholars."* |

### Still needed from you before build

- [ ] `OPENAI_API_KEY`
- [ ] `DEEPGRAM_API_KEY` (sign up at deepgram.com — $200 free credit)
- [ ] Quran Foundation API credentials ([request access](https://api-docs.quran.foundation/request-access/))
- [ ] Supabase project URL + keys (create at supabase.com)
- [ ] Download & paste `bukhari.json` → `data/sources/hadith/bukhari/`
- [ ] Optional: travel duas JSON → `data/sources/misc/duas/`

---

## 12. Out of Scope for v1

- User accounts / social features (unless you request)
- Payment / subscriptions
- Fatwa or personal religious rulings
- Mock or placeholder Quran/Hadith text
- Multiple unnecessary markdown docs

---

## 13. Success Criteria

MVP is done when:

1. Real Quran and Hadith load from your provided sources
2. User can browse, search, and ask questions with **verifiable citations**
3. English and Urdu translations work
4. App is deployed (Vercel + Python host) and usable on mobile browser
5. No mocked data in production paths

---

*Next step: Paste Bukhari file + share API keys → scaffold repo and begin Week 1.*
