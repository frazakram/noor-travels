#!/usr/bin/env python3
"""Run API health, TTS, and chat eval tests."""
import asyncio
import json
import subprocess
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
API = "http://localhost:8000"


def test_health() -> bool:
    try:
        r = httpx.get(f"{API}/api/health", timeout=10)
        ok = r.status_code == 200 and r.json().get("status") == "ok"
        print(f"[{'PASS' if ok else 'FAIL'}] health")
        return ok
    except Exception as exc:
        print(f"[FAIL] health: {exc}")
        return False


def test_duas() -> bool:
    try:
        r = httpx.get(f"{API}/api/duas/travel", timeout=15)
        ok = r.status_code == 200 and len(r.json()) >= 1
        print(f"[{'PASS' if ok else 'FAIL'}] duas/travel")
        return ok
    except Exception as exc:
        print(f"[FAIL] duas: {exc}")
        return False


def test_quran_hi() -> bool:
    try:
        r = httpx.get(f"{API}/api/quran/surahs/1?translation=hi", timeout=15)
        data = r.json()
        ayah = data["ayahs"][0]
        hi = ayah.get("translation_hi") or ayah.get("translation") or ""
        ok = r.status_code == 200 and len(hi) > 5
        print(f"[{'PASS' if ok else 'FAIL'}] quran hindi translation")
        return ok
    except Exception as exc:
        print(f"[FAIL] quran hi: {exc}")
        return False


async def test_tts_langs() -> bool:
    ok_all = True
    samples = {
        "en": "In the name of Allah, the Most Gracious, the Most Merciful.",
        "hi": "अल्लाह के नाम से जो बड़ा मेहरबान निहायत रहम वाला है।",
        "ur": "شروع اللہ کے نام سے جو بڑا مہربان نہایت رحم والا ہے",
    }
    async with httpx.AsyncClient(timeout=90) as client:
        for lang, text in samples.items():
            try:
                r = await client.post(
                    f"{API}/api/tts/speak",
                    json={"text": text, "lang": lang},
                )
                ok = r.status_code == 200 and len(r.content) > 500
                print(f"[{'PASS' if ok else 'FAIL'}] tts/{lang} ({len(r.content)} bytes)")
                ok_all = ok_all and ok
            except Exception as exc:
                print(f"[FAIL] tts/{lang}: {exc}")
                ok_all = False
    return ok_all


def test_learn_quran_static() -> bool:
    """Learn Quran course JSON (served from frontend/public in prod)."""
    repo = Path(__file__).resolve().parents[2]
    index = repo / "frontend" / "public" / "data" / "learn-quran" / "index.json"
    lessons = repo / "frontend" / "public" / "data" / "learn-quran" / "lessons.json"
    try:
        idx = json.loads(index.read_text())
        les = json.loads(lessons.read_text())
        ok = (
            index.exists()
            and lessons.exists()
            and len(idx.get("modules", [])) >= 6
            and len(les) >= 20
            and idx.get("meta", {}).get("total_lessons") == len(les)
        )
        print(f"[{'PASS' if ok else 'FAIL'}] learn-quran static ({len(les)} lessons)")
        return ok
    except Exception as exc:
        print(f"[FAIL] learn-quran static: {exc}")
        return False


def test_question_library_static() -> bool:
    repo = Path(__file__).resolve().parents[2]
    index = repo / "frontend" / "public" / "data" / "question-library-index.json"
    try:
        data = json.loads(index.read_text())
        ok = data.get("total", 0) >= 6000 and len(data.get("items", [])) >= 6000
        print(f"[{'PASS' if ok else 'FAIL'}] question-library static ({data.get('total', 0)} items)")
        return ok
    except Exception as exc:
        print(f"[FAIL] question-library static: {exc}")
        return False


def test_quran_audio() -> bool:
    try:
        r = httpx.get(f"{API}/api/quran/audio/surahs/1?reciter=ar.alafasy", timeout=30)
        data = r.json()
        ok = r.status_code == 200 and len(data.get("ayahs", [])) >= 1 and bool(data["ayahs"][0].get("audio"))
        print(f"[{'PASS' if ok else 'FAIL'}] quran audio")
        return ok
    except Exception as exc:
        print(f"[FAIL] quran audio: {exc}")
        return False


def test_chat_sample() -> bool:
    try:
        r = httpx.post(
            f"{API}/api/rag/chat",
            json={"message": "what is dua for exams?", "lang": "en", "history": []},
            timeout=120,
        )
        data = r.json()
        answer = (data.get("answer") or "").lower()
        ok = r.status_code == 200 and "travel" not in answer and any(
            k in answer for k in ("knowledge", "exam", "learn", "20:114")
        )
        print(f"[{'PASS' if ok else 'FAIL'}] chat sample")
        return ok
    except Exception as exc:
        print(f"[FAIL] chat sample: {exc}")
        return False


def run_chat_eval() -> bool:
    print("\n--- Chat eval suite ---")
    proc = subprocess.run(
        [sys.executable, str(ROOT / "ingestion" / "eval_chat.py")],
        cwd=str(ROOT),
        env={**dict(**{k: v for k, v in __import__("os").environ.items()}), "FORCE_SQLITE": "1"},
    )
    return proc.returncode == 0


def main():
    print("=== Noor Safar test suite ===\n")
    results = [
        test_health(),
        test_duas(),
        test_quran_hi(),
        test_quran_audio(),
        test_learn_quran_static(),
        test_question_library_static(),
        asyncio.run(test_tts_langs()),
        test_chat_sample(),
        run_chat_eval(),
    ]
    passed = sum(results)
    total = len(results)
    print(f"\n=== Overall: {passed}/{total} suites passed ===")
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
