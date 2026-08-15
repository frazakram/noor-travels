const CACHE = "noor-safar-v6";

/** Audio must never enter Cache Storage: every TTS clip and recitation ayah
 *  was being written to disk on the fetch path (a multi-MB cache.put per
 *  request — jank while scrolling/playing, and unbounded storage growth).
 *  Offline audio wouldn't play from here anyway; the native queue streams. */
function isAudio(req, res) {
  if (/\/api\/tts\/|\/api\/quran\/audio\/|\.(mp3|m4a|ogg|wav|webm)(\?|$)/.test(req.url)) return true;
  const type = res.headers.get("content-type") || "";
  return type.startsWith("audio/");
}
const ASSETS = ["/", "/quran", "/duas", "/hadith", "/khutba", "/logo.png", "/logo-sm.png", "/logo-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // RSC payloads belong to one build; caching them serves stale route trees.
  if (req.url.includes("_rsc=")) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        // Never cache errors — a cached 404 poisons the offline fallback.
        if (res.ok && req.url.startsWith(self.location.origin) && !isAudio(req, res)) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("/"))),
  );
});
