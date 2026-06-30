"use client";

import { useEffect, useState } from "react";

export function RegisterServiceWorker() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").then(() => setReady(true)).catch(() => setReady(false));
  }, []);

  if (!ready) return null;

  return (
    <div className="fixed bottom-24 left-4 z-40 rounded-full border border-noor-200 bg-white/90 px-3 py-1 text-[10px] font-medium text-noor-700 shadow-sm backdrop-blur dark:border-noor-700 dark:bg-noor-900/90 dark:text-noor-100">
      Offline ready
    </div>
  );
}
