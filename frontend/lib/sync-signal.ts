/**
 * Stores call this after saving something the account syncs (see lib/progress-sync.ts). It only
 * fires an event, so a store doesn't import the sync code, and saving stays instant: the sync
 * picks the change up later, batched, in the background.
 */
export const PROGRESS_CHANGED_EVENT = "noor:progress-changed";
/** Fired after a sync wrote changes from another device into local storage. */
export const PROGRESS_SYNCED_EVENT = "noor:progress-synced";

export function notifyProgressChanged(namespace: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROGRESS_CHANGED_EVENT, { detail: namespace }));
}
