const CACHE_NAME = "pwx-v1";
const STATIC_ASSETS = ["/", "/manifest.json", "/icon-192.svg", "/icon-512.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and external requests (API / CDN)
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  // Skip Vite HMR websocket
  if (url.pathname.startsWith("/@") || url.pathname.startsWith("/node_modules")) return;

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

      // Cache-first for assets
      return cached || networkFetch;
    })
  );
});
