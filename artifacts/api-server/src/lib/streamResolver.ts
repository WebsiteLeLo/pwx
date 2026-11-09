import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import CryptoJS from "crypto-js";
import { logger } from "./logger";

export interface ResolvedStream {
  streamUrl: string;
  clearKeys?: Record<string, string>;
  title?: string;
}

// In-memory cache for resolved streams (valid for 2 hours)
interface CacheEntry {
  data: ResolvedStream;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

let cachedScriptCode = "";
function getScriptCode(): string {
  if (cachedScriptCode) return cachedScriptCode;
  try {
    const candidates = [
      path.resolve(process.cwd(), "artifacts/api-server/src/lib/video-script.js"),
      path.resolve(process.cwd(), "src/lib/video-script.js"),
      "/tmp/video-script.js",
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        cachedScriptCode = fs.readFileSync(p, "utf8");
        return cachedScriptCode;
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to read video-script.js");
  }
  return "";
}

export async function resolveStreamWithVidcloud(
  batchId: string,
  subjectId: string,
  videoId: string
): Promise<ResolvedStream | null> {
  const cacheKey = `${batchId}:${subjectId}:${videoId}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > now) {
    return hit.data;
  }

  const scriptCode = getScriptCode();
  if (!scriptCode) {
    logger.warn("video-script.js code not found on server");
    return null;
  }

  const vidcloudUrl = `https://vidcloud.eu.org/play.php?batch_id=${encodeURIComponent(batchId)}&subject_id=${encodeURIComponent(subjectId || "")}&video_id=${encodeURIComponent(videoId)}&video_type=new`;

  try {
    const resp = await fetch(vidcloudUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": "https://www.pw.live/",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) {
      logger.warn({ status: resp.status, vidcloudUrl }, "vidcloud fetch failed");
      return null;
    }

    const html = await resp.text();
    if (!html.includes("enc_video_url")) {
      logger.warn("vidcloud HTML does not contain enc_video_url");
      return null;
    }

    const dom = new JSDOM(html, {
      url: "https://vidcloud.eu.org/play.php",
      runScripts: "outside-only",
      resources: "usable",
    });

    const win = dom.window as any;
    win.CryptoJS = CryptoJS;

    let loadedUrl = "";
    let extractedClearKeys: Record<string, string> | undefined = undefined;

    class MockShakaPlayer {
      attach() {
        return Promise.resolve();
      }
      configure(cfg: any) {
        if (cfg?.drm?.clearKeys) {
          extractedClearKeys = cfg.drm.clearKeys;
        }
      }
      getNetworkingEngine() {
        return {
          registerRequestFilter: () => {},
        };
      }
      load(url: string) {
        loadedUrl = url;
        return Promise.resolve();
      }
      isLive() {
        return false;
      }
      seekRange() {
        return { start: 0, end: 100 };
      }
      getVariantTracks() {
        return [];
      }
      addEventListener() {}
      destroy() {
        return Promise.resolve();
      }
    }
    (MockShakaPlayer as any).isBrowserSupported = () => true;

    win.shaka = {
      Player: MockShakaPlayer,
      polyfill: { installAll: () => {} },
      net: {
        NetworkingEngine: {
          RequestType: { MANIFEST: 0, SEGMENT: 1, LICENSE: 2 },
        },
      },
      util: { Error: { Severity: { RECOVERABLE: 1 } } },
    };

    class MockHls {
      loadSource(src: string) {
        if (!loadedUrl) loadedUrl = src;
      }
      attachMedia() {}
      on() {}
      destroy() {}
    }
    (MockHls as any).isSupported = () => true;
    (MockHls as any).Events = { MANIFEST_PARSED: "m", LEVEL_LOADED: "l", ERROR: "e" };
    (MockHls as any).ErrorTypes = { NETWORK_ERROR: "n", MEDIA_ERROR: "m" };
    win.Hls = MockHls;

    try {
      win.eval(scriptCode);
    } catch (evalErr) {
      // Script may attempt DOM manipulation not supported by jsdom
    }

    if (loadedUrl) {
      const result: ResolvedStream = {
        streamUrl: loadedUrl,
        clearKeys: extractedClearKeys,
      };
      // Cache for 2 hours
      cache.set(cacheKey, {
        data: result,
        expiresAt: now + 2 * 60 * 60 * 1000,
      });
      return result;
    }

    return null;
  } catch (err) {
    logger.error({ err, batchId, videoId }, "resolveStreamWithVidcloud error");
    return null;
  }
}

