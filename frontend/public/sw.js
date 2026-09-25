/** Audio must never enter Cache Storage: every TTS clip and recitation ayah
 *  was being written to disk on the fetch path (a multi-MB cache.put per
 *  request — jank while scrolling/playing, and unbounded storage growth).
 *  Offline audio wouldn't play from here anyway; the native queue streams. */
function isAudio(req, res) {
  if (/\/api\/tts\/|\/api\/quran\/audio\/|\.(mp3|m4a|ogg|wav|webm)(\?|$)/.test(req.url)) return true;
  const type = res.headers.get("content-type") || "";
  return type.startsWith("audio/");
}

/** Dynamic API JSON must not sit in Cache Storage — an empty cold response
 *  (e.g. before a seed) would otherwise sticky-serve "No results" after data
 *  lands. Audio is already excluded above; this covers the rest of /api/*. */
function isApiData(req) {
  try {
    return new URL(req.url).pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

// Bump VERSION to drop every old cache on the next visit. Each cache is capped so a
// long-lived install can't grow without bound across deploys.
const VERSION = "v9";
const SHELL = `noor-shell-${VERSION}`;
const STATIC = `noor-static-${VERSION}`;
const PAGES = `noor-pages-${VERSION}`;
const RUNTIME = `noor-runtime-${VERSION}`;
const LIMITS = { [STATIC]: 150, [PAGES]: 25, [RUNTIME]: 120 };
const SHELL_ASSETS = ["/", "/quran", "/hadith", "/khutba", "/adhkar", "/logo.png", "/logo-sm.png", "/logo-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL, STATIC, PAGES, RUNTIME]);
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

/** Cache keys come back in insertion order, so trimming from the front evicts the oldest. */
async function putBounded(cacheName, req, res) {
  const cache = await caches.open(cacheName);
  await cache.put(req, res);
  const keys = await cache.keys();
  const excess = keys.length - LIMITS[cacheName];
  for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
}

function cacheFor(req, url) {
  if (url.pathname.startsWith("/_next/static/")) return STATIC;
  if (req.mode === "navigate") return PAGES;
  return RUNTIME;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // RSC payloads belong to one build; caching them serves stale route trees.
  if (req.url.includes("_rsc=")) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || isApiData(req)) return;
  const cacheName = cacheFor(req, url);

  // Hashed build assets never change, so serve them from cache when present.
  if (cacheName === STATIC) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) event.waitUntil(putBounded(STATIC, req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Never cache errors — a cached 404 poisons the offline fallback.
        if (res.ok && !isAudio(req, res)) event.waitUntil(putBounded(cacheName, req, res.clone()));
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          // Only page navigations fall back to the cached app shell. Serving
          // the HTML of "/" for a failed image/script/data request paints
          // broken images (an <img> receiving HTML) instead of letting the
          // browser handle the miss — seen live on a slow mobile connection.
          if (req.mode === "navigate") return caches.match("/");
          return Response.error();
        }),
      ),
  );
});
