# Session report — 11 Jul 2026

**Session:** Noor Safar — Recommended set + Quran reader fixes  
**Date:** 2026-07-11

---

## Features shipped

| # | Feature |
|---|---|
| 1 | Quran last-read + bookmarks |
| 2 | Travel mode widget (qasr/jam' + travel duas) |
| 3 | Prayer month/year stats |
| 4 | Hadith favorites + HOTD archive |
| 5 | Settings hub (language, salah, notifications, a11y) |
| 6 | Quran playback speed (0.75–1.5×) + share ayah |
| 7 | Accessibility: font size + high contrast |
| 8 | Granular notifications (Learn Quran + gratitude) |
| 9 | Learn Quran module quiz + badges |
| 10 | Hadith of the Day by topic preference |
| 11 | Daily gratitude journal (Fajr/Isha) |
| 12 | High-latitude salah calculation option |
| 13 | Hide weekly prayer history (persisted) |
| 14 | Mobile app-style navigation (4 primary tabs + animated center menu) |

---

## Bugs fixed

| # | Bug | Fix |
|---|-----|-----|
| 1 | Arabic verse audio cutoff | Dual-buffer / seamless prefetch |
| 2 | Duplicate repeat UI | Removed study-mode repeat; kept audio repeat |
| 3 | Auto-scroll fighting user | Follow-lock + ignore programmatic scroll |
| 4 | Bismillah not recited | Prefetch + play before ayah 1 (not 1/9) |
| 5 | Urdu translation not sticking / falling back to English | Prefs hydrate before save; prefer `translation_ur` |
| 6 | Reciter always reset to Alafasy (Al-Mishey) | Same prefs race fix; save after hydrate |
| 7 | Word highlight stuck on first word | Use ayah-relative timings (no bad duration scale) + glow |
| 8 | Page not scrolling with reciter | Retry scroll after progressive ayah mount; re-enable on play |
| 9 | Word highlight stuck with Urdu/spoken translation on | rAF time sync; ignore bad duration gate; sparse-timing → proportional |
| 10 | Spoken translation only worked with Alafasy | Refetch audio when tr URLs missing; play tr audio even if text empty |
| 11 | Bismillah missing for multiple reciters | Resolve each edition's real Fatiha 1:1 URL; fixed 403/404 sources |
| 12 | Anas highlighted verse 1 during Bismillah | Calibrated embedded Bismillah timing + normalized full-surah timeline |
| 13 | Bismillah had no word highlighting | Added synchronized four-word Bismillah glow + follow-scroll |
| 14 | Duplicate reciters in dropdown | Removed bitrate clones and duplicate display names |
| 15 | Full-surah repeat skipped later Arabic passes | Reset surah/Bismillah playback state for every pass |
| 16 | Anas selected-ayah play restarted at Bismillah | Seek normalized full-surah audio to selected ayah |

---

## Verified

- `tsc` + `next build` OK  
- Smoke: home, settings, HOTD `?topic=`, high-lat salah, learn module-quiz routes  
- Browser runtime: Anas Bismillah → 96:1 → 96:2 word transitions + auto-scroll  
- 22/22 reciter Arabic, Urdu, and available Bismillah MP3 streams checked  
- 6,236/6,236 Urdu verse translations present; backend 9/9 + chat eval 6000/6000  

---

*End of session — 2026-07-11*
