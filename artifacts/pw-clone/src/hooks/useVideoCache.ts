import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

const STORE_KEY = "pwx-offline-cache-v1";

export type CacheStatus = "none" | "caching" | "cached" | "error";

interface CachedEntry {
  segmentUrls: string[];
  cachedAt: number;
  title: string;
}

type CacheStore = Record<string, CachedEntry>;

function loadStore(): CacheStore {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
  catch { return {}; }
}
function saveStore(store: CacheStore) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* noop */ }
}

// ── ISO 8601 duration → seconds ──────────────────────────────────────────────
function parseDuration(iso: string): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || "0") * 3600) +
         (parseInt(m[2] || "0") * 60) +
         parseFloat(m[3] || "0");
}

// ── Parse MPD XML → list of all segment URLs ─────────────────────────────────
// mpdBaseUrl: the URL the MPD was fetched from — used as base when the MPD has
// no explicit <BaseURL> element (relative segment paths are resolved against it)
function parseMpdSegments(mpdText: string, mpdBaseUrl = ""): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(mpdText, "application/xml");
  const urls: string[] = [];

  // Derive directory base from the MPD URL (strip the filename)
  const urlDirBase = mpdBaseUrl ? mpdBaseUrl.replace(/\/[^/]*$/, "/") : "";

  // Global base URL: from MPD document, or the MPD's own directory
  const globalBase = doc.querySelector("MPD > BaseURL")?.textContent?.trim() ?? urlDirBase;

  // Total video duration
  const mpdEl = doc.querySelector("MPD");
  const totalDuration = parseDuration(
    mpdEl?.getAttribute("mediaPresentationDuration") ?? ""
  );

  const periods = doc.querySelectorAll("Period");
  periods.forEach((period) => {
    const periodDur = parseDuration(period.getAttribute("duration") ?? "") || totalDuration;
    const adaptationSets = period.querySelectorAll("AdaptationSet");

    adaptationSets.forEach((adaptSet) => {
      // Use only the first (highest-bandwidth) representation to limit data
      const rep = adaptSet.querySelector("Representation");
      if (!rep) return;

      const repId = rep.getAttribute("id") ?? "";
      const bandwidth = rep.getAttribute("bandwidth") ?? "";

      // BaseURL: rep > adaptSet > global
      const baseUrl =
        rep.querySelector(":scope > BaseURL")?.textContent?.trim() ??
        adaptSet.querySelector(":scope > BaseURL")?.textContent?.trim() ??
        globalBase;

      // SegmentTemplate (most common in PW streams)
      const tmpl =
        rep.querySelector(":scope > SegmentTemplate") ??
        adaptSet.querySelector(":scope > SegmentTemplate");

      if (tmpl) {
        const initAttr = tmpl.getAttribute("initialization") ?? "";
        const mediaAttr = tmpl.getAttribute("media") ?? "";
        const startNumber = parseInt(tmpl.getAttribute("startNumber") ?? "1");
        const duration = parseFloat(tmpl.getAttribute("duration") ?? "0");
        const timescale = parseFloat(tmpl.getAttribute("timescale") ?? "1");

        const fill = (tpl: string) =>
          tpl
            .replace(/\$RepresentationID\$/g, repId)
            .replace(/\$Bandwidth\$/g, bandwidth);

        if (initAttr) urls.push(baseUrl + fill(initAttr));

        if (duration > 0 && periodDur > 0) {
          const segDurationSecs = duration / timescale;
          const segCount = Math.ceil(periodDur / segDurationSecs);
          for (let i = startNumber; i < startNumber + segCount; i++) {
            urls.push(baseUrl + fill(mediaAttr).replace(/\$Number%\d+d\$/g, String(i)).replace(/\$Number\$/g, String(i)));
          }
        } else {
          // SegmentTimeline fallback
          const timeline = tmpl.querySelectorAll("S");
          let number = startNumber;
          timeline.forEach((s) => {
            const r = parseInt(s.getAttribute("r") ?? "0");
            const repeat = r + 1;
            for (let j = 0; j < repeat; j++) {
              urls.push(baseUrl + fill(mediaAttr).replace(/\$Number\$/g, String(number)));
              number++;
            }
          });
        }
        return;
      }

      // SegmentList fallback
      const segList = rep.querySelector(":scope > SegmentList") ?? adaptSet.querySelector(":scope > SegmentList");
      if (segList) {
        const init = segList.querySelector("Initialization");
        if (init) {
          const src = init.getAttribute("sourceURL") ?? "";
          if (src) urls.push(baseUrl + src);
        }
        segList.querySelectorAll("SegmentURL").forEach((seg) => {
          const media = seg.getAttribute("media") ?? "";
          if (media) urls.push(baseUrl + media);
        });
      }
    });
  });

  // De-duplicate while preserving order
  return [...new Set(urls)].filter(Boolean);
}

// ── Delete cached segments for a video from the SW cache ─────────────────────
async function evictFromSWCache(segmentUrls: string[]) {
  if (!("caches" in window)) return;
  try {
    const cache = await caches.open("pwx-segments-v1");
    await Promise.all(segmentUrls.map((url) => cache.delete(url)));
  } catch { /* noop */ }
}

// ── Public hook ───────────────────────────────────────────────────────────────
export function useVideoCache() {
  const [store, setStore] = useState<CacheStore>(loadStore);

  // Re-sync from localStorage when other tabs update
  useEffect(() => {
    const handler = () => setStore(loadStore());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const getStatus = useCallback(
    (videoId: string): CacheStatus => (store[videoId] ? "cached" : "none"),
    [store]
  );

  const cacheVideo = useCallback(
    async (
      videoId: string,
      batchId: string,
      subjectId: string,
      title: string,
      onProgress: (done: number, total: number) => void,
      signal?: AbortSignal
    ): Promise<"ok" | "error"> => {
      try {
        // 1. Get MPD URL via server-side proxy (adds proper Referer/Origin headers)
        const urlRes = await fetch(
          `/api/pw-video/${encodeURIComponent(videoId)}`,
          { signal }
        );
        if (!urlRes.ok) throw new Error(`Failed to get video URL (${urlRes.status})`);
        const urlData = await urlRes.json();
        const mpdUrl: string | undefined = urlData?.data?.videoUrl;
        if (!mpdUrl) throw new Error("Video not available for offline download");

        if (signal?.aborted) return "error";

        // 2. Fetch MPD — try direct browser fetch first (India CDN access),
        //    fall back to server proxy with vidcloud.eu.org headers if blocked.
        let mpdText: string;
        const directRes = await fetch(mpdUrl, { signal }).catch(() => null);
        if (directRes && directRes.ok) {
          mpdText = await directRes.text();
        } else {
          // Fallback: server-side proxy attempts multiple referrer variants
          const proxyRes = await fetch(
            `/api/proxy?url=${encodeURIComponent(mpdUrl)}`,
            { signal }
          );
          if (!proxyRes.ok) throw new Error(`Cannot access video stream (${proxyRes.status}). The video may be DRM-protected.`);
          mpdText = await proxyRes.text();
        }

        if (signal?.aborted) return "error";

        // 3. Parse all segment URLs — pass mpdUrl so relative paths resolve correctly
        const segmentUrls = parseMpdSegments(mpdText, mpdUrl);
        if (segmentUrls.length === 0) throw new Error("No segments found in MPD");

        // 4. Pre-fetch every segment directly from CDN — the SW intercepts each
        //    fetch and caches it under the CloudFront URL (cache-first on replay)
        const CONCURRENCY = 4;
        let done = 0;

        async function fetchSegment(url: string) {
          if (signal?.aborted) return;
          try {
            await fetch(url, { signal });
          } catch { /* individual segment failure is ok */ }
          done++;
          onProgress(done, segmentUrls.length);
        }

        for (let i = 0; i < segmentUrls.length; i += CONCURRENCY) {
          if (signal?.aborted) return "error";
          const batch = segmentUrls.slice(i, i + CONCURRENCY);
          await Promise.all(batch.map(fetchSegment));
        }

        if (signal?.aborted) return "error";

        // 5. Persist to localStorage
        const newStore: CacheStore = {
          ...loadStore(),
          [videoId]: { segmentUrls, cachedAt: Date.now(), title },
        };
        saveStore(newStore);
        setStore(newStore);

        return "ok";
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return "error";
        const msg = err instanceof Error ? err.message : "Download failed";
        console.error("[useVideoCache] cacheVideo error:", err);
        toast.error(msg, { description: "This video cannot be saved for offline use." });
        return "error";
      }
    },
    []
  );

  const removeVideo = useCallback(async (videoId: string) => {
    const entry = loadStore()[videoId];
    if (entry) await evictFromSWCache(entry.segmentUrls);
    const newStore = { ...loadStore() };
    delete newStore[videoId];
    saveStore(newStore);
    setStore(newStore);
  }, []);

  return { getStatus, cacheVideo, removeVideo, store };
}
