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
  scheduleHadithNotification?: (hour: number, minute: number, enabled: boolean) => void;
};

function bridge(): NoorAndroidBridge | null {
  if (typeof window === "undefined") return null;
  const b = (window as unknown as { NoorAndroid?: NoorAndroidBridge }).NoorAndroid;
  return b ?? null;
}

export function isNativeApp(): boolean {
  return !!(typeof window !== "undefined" && (window as unknown as { isNativeApp?: boolean }).isNativeApp);
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

export function nativeScheduleHadithNotification(hour: number, minute: number, enabled: boolean): void {
  try {
    bridge()?.scheduleHadithNotification?.(hour, minute, enabled);
  } catch {
    /* ignore */
  }
}
