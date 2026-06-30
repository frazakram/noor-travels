"use client";

const MAX_TAFSIR_CHARS = 1400;
const API = process.env.NEXT_PUBLIC_API_URL || "";

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;
let playbackGeneration = 0;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isStale(gen: number): boolean {
  return gen !== playbackGeneration;
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve([]);
  }
  if (voicesReady) return voicesReady;

  voicesReady = new Promise((resolve) => {
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length) resolve(voices);
    };
    pick();
    window.speechSynthesis.onvoiceschanged = () => pick();
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 500);
  });
  return voicesReady;
}

function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const prefs = { en: "en", ur: "ur", hi: "hi" }[lang] || "en";
  const ranked = voices.filter((v) => v.lang.toLowerCase().startsWith(prefs));
  if (ranked.length) return ranked[0];
  return voices.find((v) => v.lang.startsWith("en"));
}

export function truncateForSpeech(text: string, max = MAX_TAFSIR_CHARS): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const last = cut.lastIndexOf(". ");
  return (last > 200 ? cut.slice(0, last + 1) : cut) + "…";
}

export function beginPlaybackSession(): number {
  playbackGeneration += 1;
  stopAllPlayback();
  return playbackGeneration;
}

export function invalidatePlaybackSession(): void {
  playbackGeneration += 1;
  stopAllPlayback();
}

export function playAudioUrl(url: string, gen?: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (gen !== undefined && isStale(gen)) {
      resolve();
      return;
    }

    const audio = new Audio(url);
    const w = window as unknown as {
      __noorAudio?: HTMLAudioElement;
      __noorAudioResolve?: () => void;
      __noorBlobUrl?: string;
      __noorGen?: number;
    };
    w.__noorAudio = audio;
    w.__noorGen = gen;
    w.__noorAudioResolve = () => resolve();

    const finish = () => {
      if (w.__noorAudio === audio) {
        w.__noorAudio = undefined;
        w.__noorAudioResolve = undefined;
      }
      resolve();
    };

    audio.onended = finish;
    audio.onerror = () => {
      if (w.__noorAudio === audio) w.__noorAudio = undefined;
      reject(new Error("Audio playback failed"));
    };
    audio.play().catch(reject);
  });
}

export function stopAudio(): void {
  const w = window as unknown as {
    __noorAudio?: HTMLAudioElement;
    __noorAudioResolve?: () => void;
    __noorBlobUrl?: string;
  };
  if (w.__noorAudio) {
    w.__noorAudio.pause();
    w.__noorAudio.currentTime = 0;
    w.__noorAudio = undefined;
  }
  if (w.__noorBlobUrl) {
    URL.revokeObjectURL(w.__noorBlobUrl);
    w.__noorBlobUrl = undefined;
  }
  if (w.__noorAudioResolve) {
    w.__noorAudioResolve();
    w.__noorAudioResolve = undefined;
  }
}

async function speakViaApi(text: string, lang: string, gen?: number): Promise<void> {
  if (gen !== undefined && isStale(gen)) return;

  const res = await fetch(`${API}/api/tts/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: truncateForSpeech(text, 2000), lang }),
  });
  if (!res.ok) throw new Error(`TTS API ${res.status}`);
  if (gen !== undefined && isStale(gen)) return;

  const blob = await res.blob();
  const w = window as unknown as { __noorBlobUrl?: string };
  if (w.__noorBlobUrl) URL.revokeObjectURL(w.__noorBlobUrl);
  const url = URL.createObjectURL(blob);
  w.__noorBlobUrl = url;
  await playAudioUrl(url, gen);
}

async function speakViaBrowser(text: string, lang: string, gen?: number): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  if (gen !== undefined && isStale(gen)) return;

  const voices = await loadVoices();
  window.speechSynthesis.cancel();
  await delay(150);
  if (gen !== undefined && isStale(gen)) return;

  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(voices, lang);
    utter.lang = lang === "ur" ? "ur-PK" : lang === "hi" ? "hi-IN" : "en-US";
    if (voice) utter.voice = voice;
    utter.rate = lang === "ur" || lang === "hi" ? 0.9 : 0.95;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    window.speechSynthesis.speak(utter);
  });
}

/** Play URL if present, otherwise TTS. Used for translation + tafsir fallback. */
export async function playSpokenText(
  text: string,
  lang: string,
  audioUrl?: string | null,
  gen?: number
): Promise<void> {
  if (!text.trim() || (gen !== undefined && isStale(gen))) return;

  stopAudio();
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  await delay(80);
  if (gen !== undefined && isStale(gen)) return;

  if (audioUrl) {
    try {
      await playAudioUrl(audioUrl, gen);
      return;
    } catch {
      /* fall through to TTS */
    }
  }

  try {
    await speakViaApi(text, lang, gen);
  } catch {
    await speakViaBrowser(text, lang, gen);
  }
}

export async function speakText(text: string, lang: string): Promise<void> {
  return playSpokenText(text, lang, null);
}

export function stopSpeech(): void {
  stopAudio();
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function stopAllPlayback(): void {
  stopSpeech();
}
