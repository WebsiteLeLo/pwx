export type VideoQuality = "720p" | "480p" | "360p" | "240p";

export interface TelegramExtractResponse {
  id?: number;
  status: "success" | "error" | string;
  start_param?: string;
  title: string;
  quality: VideoQuality | string;
  file_size?: number;
  download_url?: string;
  watch_url?: string;
  direct_download_url?: string;
  direct_watch_url?: string;
  cached?: boolean;
  source_bot?: string;
  target_bot?: string;
  created_at?: string;
  updated_at?: string;
  detail?: string;
  message?: string;
}

export const QUALITY_OPTIONS: VideoQuality[] = ["720p", "480p", "360p", "240p"];

/**
 * Direct Base URL of your Telegram extraction backend API
 */
export const TELEGRAM_API_BASE = "https://videos.pwxstudy.site";

/**
 * Returns the next lower quality in the ladder (720p -> 480p -> 360p -> 240p).
 */
export function getNextLowerQuality(current: VideoQuality): VideoQuality | null {
  const idx = QUALITY_OPTIONS.indexOf(current);
  if (idx !== -1 && idx < QUALITY_OPTIONS.length - 1) {
    return QUALITY_OPTIONS[idx + 1];
  }
  return null;
}

/**
 * Normalizes input to the full Telegram bot URL expected by the API:
 * "https://t.me/AS_MultiverseRoBot?start=..."
 */
export function formatFullTelegramUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://t.me/AS_MultiverseRoBot?start=${trimmed}`;
}

/**
 * Normalizes a raw input string (which can be a full Telegram URL or just a start_param)
 * into just the start_param.
 */
export function normalizeTelegramParam(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/[?&]start=([^&#]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}

/**
 * Constructs a start_param from a batchId and childId/videoId.
 */
export function buildTelegramStartParam(batchId: string, childId: string): string {
  return `${batchId.trim()}_${childId.trim()}`;
}

/**
 * Constructs the full Telegram URL from batchId and childId.
 */
export function buildTelegramUrl(batchId: string, childId: string): string {
  return `https://t.me/AS_MultiverseRoBot?start=${batchId.trim()}_${childId.trim()}`;
}

/**
 * Helper to resolve the most reliable streamable URL for the HTML5 <video> tag.
 * LinkFilesBot watch URLs (/watch/123/456) serve an HTML Plyr web shell,
 * while /123/456 and direct_download_url serve the raw video/mp4 stream with HTTP Range support.
 */
export function resolvePlayableStreamUrl(data: TelegramExtractResponse): string {
  if (data.direct_watch_url) {
    if (data.direct_watch_url.includes("/watch/")) {
      return data.direct_watch_url.replace("/watch/", "/");
    }
    return data.direct_watch_url;
  }
  return data.direct_download_url || "";
}

/**
 * Formats bytes to human-readable size string (e.g. 686509837 -> "654.7 MB").
 */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

/**
 * Directly calls https://videos.pwxstudy.site/api/extract via POST (100% direct, zero proxy):
 * curl -X POST "https://videos.pwxstudy.site/api/extract" \
 *   -H "Content-Type: application/json" \
 *   -d '{"url": "https://t.me/AS_MultiverseRoBot?start=...", "quality": "720p"}'
 */
export async function fetchTelegramVideo(params: {
  url: string;
  quality?: VideoQuality;
  forceRefresh?: boolean;
  signal?: AbortSignal;
}): Promise<TelegramExtractResponse> {
  const { url, quality = "720p", forceRefresh = false, signal } = params;
  const fullTgUrl = formatFullTelegramUrl(url);

  if (!fullTgUrl) {
    throw new Error("No Telegram URL or start_param provided");
  }

  const payload = {
    url: fullTgUrl,
    quality,
    force_refresh: forceRefresh,
  };

  // Direct POST to https://videos.pwxstudy.site/api/extract
  const res = await fetch(`${TELEGRAM_API_BASE}/api/extract`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 404) {
    const errData = await res.json().catch(() => null);
    const err: any = new Error(
      errData?.detail ||
        errData?.message ||
        "This video is currently not available in the database for the selected quality. Please try another quality."
    );
    err.status = 404;
    err.is404 = true;
    throw err;
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    const detailMsg =
      (typeof errData?.detail === "string" ? errData.detail : "") ||
      (typeof errData?.message === "string" ? errData.message : "") ||
      `Extraction failed with HTTP ${res.status}`;
    const err: any = new Error(detailMsg);
    err.status = res.status;
    err.detail = detailMsg;
    throw err;
  }

  const data: TelegramExtractResponse = await res.json();
  return data;
}
