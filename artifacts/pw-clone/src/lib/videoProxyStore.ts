import { apiUrl } from "@/lib/apiUrl";

export const DEFAULT_VIDEO_PROXY_URL = "/api/proxy";

let currentVideoProxyUrl = DEFAULT_VIDEO_PROXY_URL;
let lastFetchedAt = 0;
const REFRESH_TTL_MS = 30_000;

export function normalizeVideoProxyUrl(raw?: string | null): string {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed || trimmed === "/" || trimmed === "/api") {
    return DEFAULT_VIDEO_PROXY_URL;
  }

  // Allow relative paths (/api/proxy) or full http(s) URLs (https://worker.workers.dev)
  if (!trimmed.startsWith("/") && !/^https?:\/\//i.test(trimmed)) {
    return DEFAULT_VIDEO_PROXY_URL;
  }

  if (/[?&]url=$/i.test(trimmed)) {
    return trimmed;
  }

  return trimmed.replace(/\/+$/, "") || DEFAULT_VIDEO_PROXY_URL;
}

export function getVideoProxyUrl(): string {
  return currentVideoProxyUrl;
}

export function setVideoProxyUrlCache(raw?: string | null): void {
  currentVideoProxyUrl = normalizeVideoProxyUrl(raw);
  lastFetchedAt = Date.now();
}

export async function refreshVideoProxyUrl(force = false): Promise<string> {
  const now = Date.now();
  if (!force && lastFetchedAt > 0 && now - lastFetchedAt < REFRESH_TTL_MS) {
    return currentVideoProxyUrl;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(apiUrl("/api/settings/video_proxy_url"), {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const rawVal =
        typeof data?.value === "string"
          ? data.value
          : typeof data?.value?.url === "string"
            ? data.value.url
            : "";
      currentVideoProxyUrl = normalizeVideoProxyUrl(rawVal);
      lastFetchedAt = Date.now();
    }
  } catch {
    // Keep existing cached/default URL on transient network error
  }

  return currentVideoProxyUrl;
}

export function isAlreadyProxiedUrl(u: string): boolean {
  if (!u) return false;
  if (
    u.includes("/proxy?url=") ||
    u.includes("/streamvideo-proxy?url=") ||
    u.includes("/pdf?url=") ||
    /[?&]url=https?%3A/i.test(u)
  ) {
    return true;
  }
  const base = currentVideoProxyUrl;
  if (base && base !== DEFAULT_VIDEO_PROXY_URL && u.startsWith(base)) {
    return true;
  }
  return false;
}

export function buildVideoProxyUrl(targetUrl: string, customBase?: string): string {
  const base = customBase ? normalizeVideoProxyUrl(customBase) : currentVideoProxyUrl;
  const encoded = encodeURIComponent(targetUrl);

  if (/[?&]url=$/i.test(base)) {
    return `${base}${encoded}`;
  }
  if (base.includes("?")) {
    return `${base}&url=${encoded}`;
  }
  return `${base}?url=${encoded}`;
}

export function buildVideoProxyTestUrl(rawBase: string): string {
  const base = normalizeVideoProxyUrl(rawBase).replace(/[?&]url=$/i, "");
  return base.includes("?") ? `${base}&ping=1` : `${base}?ping=1`;
}

