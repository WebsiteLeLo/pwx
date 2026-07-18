const CACHE_NAME = "pwx-v3";
const SEG_CACHE_NAME = "pwx-segments-v1";
const API_CACHE_NAME = "pwx-api-v1";

const SEG_MAX = 8000;  // max DASH segment entries (high for full offline lectures)
const API_MAX = 500;   // max API response entries

// Static shell assets to pre-cache on install
const STATIC_ASSETS = ["/", "/manifest.json", "/icon-192.svg", "/icon-512.svg"];

// External API origins/prefixes we want to cache (stale-while-revalidate)
const API_ORIGINS = [
  "https://pwsecure.gourav23032009.workers.dev",
  "https://rarestudy.github.io",
];

// Endpoints that must NEVER be served from cache (time-sensitive tokens)
const NO_CACHE_PATTERNS = [
  "/v1/videos/get-otp",   // video OTP — expires quickly
  "/v3/test-service/tests/", // DPP start-test — session-specific
];

function shouldSkipCache(url) {
  return NO_CACHE_PATTERNS.some((p) => url.pathname.includes(p));
}

function isApiRequest(url) {
  return API_ORIGINS.some((origin) => url.href.startsWith(origin));
}

// ── Install: pre-cache shell ──────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: evict old caches ────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![CACHE_NAME, SEG_CACHE_NAME, API_CACHE_NAME].includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) {
    await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
  }
}

// Stale-while-revalidate: return cached response immediately, update in background
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
        trimCache(cacheName, API_MAX);
      }
      return response;
    })
    .catch(() => null);

  return cached || networkPromise;
}

// ── Fetch handler ─────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip Vite dev internals
  if (url.pathname.startsWith("/@") || url.pathname.startsWith("/node_modules")) return;

  // ── 1. DASH video segments (same-origin proxy) — cache-first ─────────────
  if (url.pathname.includes("/api/dash-seg/") || url.pathname.includes("/api/proxy")) {
    const cacheKey = new Request(url.pathname);
    event.respondWith(
      caches.open(SEG_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(cacheKey);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          cache.put(cacheKey, response.clone());
          trimCache(SEG_CACHE_NAME, SEG_MAX);
        }
        return response;
      })
    );
    return;
  }

  // ── 2. Cross-origin PW API calls — stale-while-revalidate ────────────────
  if (isApiRequest(url)) {
    if (shouldSkipCache(url)) return; // never cache OTP / session endpoints
    event.respondWith(staleWhileRevalidate(request, API_CACHE_NAME));
    return;
  }

  // ── 3. CloudFront PW video segments — cache-first ────────────────────────
  if (url.hostname.endsWith(".cloudfront.net")) {
    event.respondWith(
      caches.open(SEG_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request.url);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) {
            cache.put(request.url, response.clone());
            trimCache(SEG_CACHE_NAME, SEG_MAX);
          }
          return response;
        } catch {
          return new Response("Offline", { status: 503 });
        }
      })
    );
    return;
  }

  // ── 4. Cross-origin everything else — skip (fonts, CDN images, etc.) ──────
  if (url.origin !== self.location.origin) return;

  // ── 4. Same-origin: network-first for HTML, cache-first for assets ────────
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok && response.status < 400) {
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => cached);

      // Network-first for HTML — always serve fresh app shell
      if (request.headers.get("accept")?.includes("text/html")) {
        return networkFetch.catch(
          () => cached || new Response("Offline", { status: 503 })
        );
      }

      return cached || networkFetch;
    })
  );
});
