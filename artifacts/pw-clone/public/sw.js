const CACHE_NAME = "pwx-v2";
const SEG_CACHE_NAME = "pwx-segments-v1";
const SEG_MAX = 300; // max number of segment entries to keep

const STATIC_ASSETS = ["/", "/manifest.json", "/icon-192.svg", "/icon-512.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== SEG_CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Trim segment cache to SEG_MAX entries to avoid eating too much disk
async function trimSegmentCache() {
  const cache = await caches.open(SEG_CACHE_NAME);
  const keys = await cache.keys();
  if (keys.length > SEG_MAX) {
    const toDelete = keys.slice(0, keys.length - SEG_MAX);
    await Promise.all(toDelete.map((k) => cache.delete(k)));
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.pathname.startsWith("/@") || url.pathname.startsWith("/node_modules")) return;

  // ── DASH segment: cache-first, long-lived ────────────────────────────────
  // Strip query string for the cache key — the sig is in the path, not QS,
  // so the path alone uniquely identifies the segment content.
  if (url.pathname.includes("/api/dash-seg/") || url.pathname.includes("/api/proxy")) {
    const cacheKey = new Request(url.pathname); // ignore QS for key
    event.respondWith(
      caches.open(SEG_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(cacheKey);
        if (cached) return cached;

        const response = await fetch(request);
        if (response.ok) {
          cache.put(cacheKey, response.clone());
          trimSegmentCache();
        }
        return response;
      })
    );
    return;
  }

  // ── Everything else: skip cross-origin ───────────────────────────────────
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok && response.status < 400) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      // Network-first for HTML (always fresh app shell)
      if (request.headers.get("accept")?.includes("text/html")) {
        return networkFetch.catch(() => cached || new Response("Offline", { status: 503 }));
      }

      // Cache-first for static assets
      return cached || networkFetch;
    })
  );
});
