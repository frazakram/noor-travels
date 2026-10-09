/** Pure helpers for offline surah audio (no browser or bridge access — unit-tested). */

/** Recorded translation audio exists for English and Urdu only; Hindi is synthesized online. */
export type TrLang = "en" | "ur" | "none";

export type AudioManifest = {
  ayahs: { audio: string | null; translation_audio?: string | null }[];
  bismillah_audio?: string | null;
  [k: string]: unknown;
};

export type AudioDownloadState = {
  state: "saved" | "downloading" | "failed";
  done: number;
  total: number;
  bytes: number;
  error?: string | null;
};

export function trLangFor(includeTranslation: boolean, lang: string): TrLang {
  return includeTranslation && (lang === "en" || lang === "ur") ? lang : "none";
}

export function downloadKey(surah: number, reciter: string, tr: TrLang): string {
  return `${surah}:${reciter}:${tr}`;
}

/** Every distinct clip the manifest plays, in playback order. */
export function audioUrlsOf(manifest: AudioManifest): string[] {
  const urls: string[] = [];
  const add = (u?: string | null) => {
    if (u && !urls.includes(u)) urls.push(u);
  };
  add(manifest.bismillah_audio);
  for (const a of manifest.ayahs ?? []) {
    add(a.audio);
    add(a.translation_audio);
  }
  return urls;
}

/**
 * Saved manifests that can stand in for a request, best first. A manifest with translation
 * audio also serves a request that wants none (the reader ignores the extra clips), but never
 * the other way round or for another language.
 */
export function lookupKeys(surah: number, reciter: string, tr: TrLang): string[] {
  const keys = [downloadKey(surah, reciter, tr)];
  if (tr === "none") keys.push(downloadKey(surah, reciter, "en"), downloadKey(surah, reciter, "ur"));
  return keys;
}
