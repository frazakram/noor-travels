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
