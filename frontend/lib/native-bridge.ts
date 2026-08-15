"use client";

export type NativeQueueItem = {
  url: string;
  title: string;
  ayahIndex: number;
  kind: "arabic" | "translation" | "tafsir";
};

type NoorAndroidBridge = {
  setQuranPlaying?: (playing: boolean) => void;
  playQuranQueue?: (playlistJson: string) => void;
  stopQuranPlayback?: () => void;
  schedulePrayerAlarm?: (prayerName: string, hour: number, minute: number, enabled: boolean) => void;
  schedulePrayerAlarmTz?: (
    prayerName: string,
    hour: number,
    minute: number,
    timeZoneId: string,
    enabled: boolean,
  ) => void;
  scheduleHadithNotification?: (hour: number, minute: number, enabled: boolean) => void;
  share?: (title: string, text: string) => void;
  /** Added for khutba PDF export; absent on APKs built before that shipped. */
  savePdf?: (filename: string, base64: string) => boolean;
  /** "1.2 (3)" — versionName and versionCode of the installed APK. */
  appVersion?: () => string;
};

function bridge(): NoorAndroidBridge | null {
  if (typeof window === "undefined") return null;
  const b = (window as unknown as { NoorAndroid?: NoorAndroidBridge }).NoorAndroid;
  return b ?? null;
}

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  // window.isNativeApp is injected on page finish; the NoorAndroid bridge object
  // exists from document start, so check both to avoid a pre-injection race.
  return !!(window as unknown as { isNativeApp?: boolean }).isNativeApp || bridge() !== null;
}

export function nativeSetQuranPlaying(playing: boolean): void {
  try {
    bridge()?.setQuranPlaying?.(playing);
  } catch {
    /* bridge not ready */
  }
}

export function nativePlayQuranQueue(
  surahName: string,
  items: NativeQueueItem[],
): boolean {
  try {
    const b = bridge();
    if (!b?.playQuranQueue || !items.length) return false;
    b.playQuranQueue(JSON.stringify({ surahName, items }));
    return true;
  } catch {
    return false;
  }
}

export function nativeStopQuranPlayback(): void {
  try {
    bridge()?.stopQuranPlayback?.();
  } catch {
    /* ignore */
  }
}

export function nativeUpdateQuranNotification(title: string, artist: string): void {
  try {
    const b = bridge() as NoorAndroidBridge & { updateQuranNotification?: (t: string, a: string) => void };
    b?.updateQuranNotification?.(title, artist);
  } catch {
    /* ignore */
  }
}

export function nativeSchedulePrayerAlarm(
  prayerName: string,
  hour: number,
  minute: number,
  enabled: boolean,
): void {
  try {
    bridge()?.schedulePrayerAlarm?.(prayerName, hour, minute, enabled);
  } catch {
    /* ignore */
  }
}

/** Returns false when the installed APK does not expose the timezone-aware method. */
export function nativeSchedulePrayerAlarmTz(
  prayerName: string,
  hour: number,
  minute: number,
  timeZoneId: string,
  enabled: boolean,
): boolean {
  try {
    const b = bridge();
    if (!b?.schedulePrayerAlarmTz) return false;
    b.schedulePrayerAlarmTz(prayerName, hour, minute, timeZoneId, enabled);
    return true;
  } catch {
    return false;
  }
}

export function nativeScheduleHadithNotification(hour: number, minute: number, enabled: boolean): void {
  try {
    bridge()?.scheduleHadithNotification?.(hour, minute, enabled);
  } catch {
    /* ignore */
  }
}

/** Installed APK version, or "" on the web and on APKs predating the method. */
export function nativeAppVersion(): string {
  try {
    return bridge()?.appVersion?.() || "";
  } catch {
    return "";
  }
}

/** Hand PDF bytes to Android to write and open. False on older APKs and on the
 *  web, so callers fall back to a normal blob download. */
export function nativeSavePdf(filename: string, base64: string): boolean {
  try {
    const b = bridge();
    if (!b?.savePdf) return false;
    return b.savePdf(filename, base64) !== false;
  } catch {
    return false;
  }
}

/** Native Android share sheet (image card via FileProvider — reaches WhatsApp/Instagram Stories,
 * unlike the WebView's missing Web Share API). Returns false when the bridge isn't available. */
export function nativeShare(title: string, text: string): boolean {
  try {
    const b = bridge();
    if (!b?.share) return false;
    b.share(title, text);
    return true;
  } catch {
    return false;
  }
}
