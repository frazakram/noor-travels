/**
 * The word being recited in the playing ayah, kept outside React state.
 *
 * Playback moves it several times a second (native position ticks every 150 ms, the web
 * player on every frame). As state in useSurahAudio it re-rendered the whole reader, every
 * mounted ayah card and every word, on each change: ~1.1 s of main-thread work per 10 s on
 * Al-Baqarah, while the user scrolled. Only the playing ayah's text subscribes now
 * (components/AyahWordText.tsx), so a word change re-renders that one ayah.
 */
type Listener = () => void;

let current = -1;
const listeners = new Set<Listener>();

export function setWordHighlight(index: number): void {
  if (index === current) return;
  current = index;
  listeners.forEach((l) => l());
}

export function getWordHighlight(): number {
  return current;
}

export function subscribeWordHighlight(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
