import { db, siteSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const PW_CLIENT_ID = "5eb393ee95fab7468a79d189";
const PW_API_ORIGIN = "https://api.penpencil.co";
const TOKEN_SETTINGS_TTL_MS = 30_000;
const BATCH_INDEX_TTL_MS = 30 * 60_000;
const FAILED_BATCH_TTL_MS = 15 * 60_000;

export interface OwnResolvedStream {
  url: string;
  container: "HLS" | "DASH";
  source: "own-pw-token";
  signatureExpireAt?: number;
}

export interface PwTokenStatus {
  preview: string;
  userId?: string;
  username?: string;
  expiresAt?: string;
  expired: boolean;
  valid: boolean;
  enrolledBatchCount: number;
  sampleBatches: string[];
  error?: string;
}

interface BatchIndexEntry {
  batchIds: Set<string>;
  batches: { id: string; name: string }[];
  fetchedAt: number;
}

let cachedTokens: string[] = [];
let cachedTokensAt = 0;

const tokenBatchesCache = new Map<string, BatchIndexEntry>();
const failedBatchTokenCache = new Map<string, number>();
const resolvedStreamCache = new Map<
  string,
  { result: OwnResolvedStream; expiresAt: number }
>();

export function invalidateOwnTokenCache(): void {
  cachedTokensAt = 0;
  cachedTokens = [];
  tokenBatchesCache.clear();
  failedBatchTokenCache.clear();
  resolvedStreamCache.clear();
}

function normalizeTokenList(raw: unknown): string[] {
  let candidates: string[] = [];
  if (Array.isArray(raw)) {
    candidates = raw.filter((v): v is string => typeof v === "string");
  } else if (raw && typeof raw === "object" && Array.isArray((raw as any).tokens)) {
    candidates = (raw as any).tokens.filter((v: unknown): v is string => typeof v === "string");
  } else if (typeof raw === "string") {
    candidates = raw.split(/[\r\n,]+/);
  }

  const seen = new Set<string>();
  const clean: string[] = [];
  for (const item of candidates) {
    const stripped = item.trim().replace(/^Bearer\s+/i, "").trim();
    if (stripped.length > 20 && !seen.has(stripped)) {
      seen.add(stripped);
      clean.push(stripped);
    }
  }
  return clean;
}

function decodeJwtClaims(token: string): {
  userId?: string;
  username?: string;
  expMs?: number;
} {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return {};
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return {
      userId: typeof payload?.data?._id === "string" ? payload.data._id : undefined,
      username: typeof payload?.data?.username === "string" ? payload.data.username : undefined,
      expMs: typeof payload?.exp === "number" ? payload.exp * 1000 : undefined,
    };
  } catch {
    return {};
  }
}

function maskToken(token: string): string {
  if (token.length <= 16) return "***";
  return `${token.slice(0, 10)}...${token.slice(-6)}`;
}

function buildPwHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "client-id": PW_CLIENT_ID,
    "client-type": "WEB",
    "client-version": "2.4.0",
    randomId: crypto.randomUUID(),
    Accept: "application/json, text/plain, */*",
    Origin: "https://www.pw.live",
    Referer: "https://www.pw.live/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  };
}

export async function getConfiguredPwTokens(): Promise<string[]> {
  const now = Date.now();
  if (now - cachedTokensAt < TOKEN_SETTINGS_TTL_MS && cachedTokens.length > 0) {
    return cachedTokens;
  }

  let tokens: string[] = [];
  try {
    const [row] = await db
      .select()
      .from(siteSettingsTable)
      .where(eq(siteSettingsTable.key, "pw_auth_tokens"));
    tokens = normalizeTokenList(row?.value);
  } catch {
    // Fall back to environment variable if DB is unavailable
  }

  if (tokens.length === 0 && process.env.PW_AUTH_TOKENS) {
    tokens = normalizeTokenList(process.env.PW_AUTH_TOKENS);
  }

  cachedTokens = tokens;
  cachedTokensAt = now;
  return tokens;
}

async function getTokenBatches(token: string): Promise<BatchIndexEntry> {
  const now = Date.now();
  const hit = tokenBatchesCache.get(token);
  if (hit && now - hit.fetchedAt < BATCH_INDEX_TTL_MS) {
    return hit;
  }

  const batchIds = new Set<string>();
  const batches: { id: string; name: string }[] = [];

  for (let page = 1; page <= 10; page++) {
    const resp = await fetch(`${PW_API_ORIGIN}/v3/batches/my-batches?mode=1&page=${page}`, {
      headers: buildPwHeaders(token),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      if (page === 1) {
        throw new Error(`HTTP ${resp.status}`);
      }
      break;
    }
    const json = (await resp.json()) as any;
    const rows = Array.isArray(json?.data) ? json.data : [];
    if (rows.length === 0) break;
    for (const b of rows) {
      if (typeof b?._id === "string") {
        batchIds.add(b._id);
        batches.push({ id: b._id, name: String(b.name || b._id) });
      }
    }
    if (rows.length < 15) break;
  }

  const entry: BatchIndexEntry = { batchIds, batches, fetchedAt: now };
  tokenBatchesCache.set(token, entry);
  return entry;
}

async function verifyHlsManifestReachable(hlsUrl: string): Promise<boolean> {
  try {
    const resp = await fetch(hlsUrl, {
      headers: {
        Origin: "https://www.pw.live",
        Referer: "https://www.pw.live/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return false;
    const text = await resp.text();
    return text.includes("#EXTM3U");
  } catch {
    return false;
  }
}

async function fetchVideoUrlDetails(
  token: string,
  batchId: string,
  targetChildId: string,
): Promise<OwnResolvedStream | null> {
  const qs = new URLSearchParams({
    type: "BATCHES",
    videoContainerType: "HLS",
    reqType: "query",
    childId: targetChildId,
    parentId: batchId,
  });

  const resp = await fetch(`${PW_API_ORIGIN}/v1/videos/video-url-details?${qs.toString()}`, {
    headers: buildPwHeaders(token),
    signal: AbortSignal.timeout(8000),
  });

  if (resp.status === 401 || resp.status === 403) {
    failedBatchTokenCache.set(`${batchId}:${token}`, Date.now());
    return null;
  }
  if (!resp.ok) {
    return null;
  }

  const json = (await resp.json()) as any;
  const rawUrl = typeof json?.data?.url === "string" ? json.data.url : "";
  const signedQs = typeof json?.data?.signedUrl === "string" ? json.data.signedUrl : "";
  const signatureExpireAt =
    typeof json?.data?.signatureExpireAt === "number" ? json.data.signatureExpireAt : undefined;

  if (!rawUrl || !signedQs) return null;

  // Prefer multi-bitrate HLS master.m3u8 under the same wildcard CloudFront policy so
  // Hls.js + AES-128 enc.key work natively without ClearKey/Widevine restrictions.
  if (/\/master\.mpd$/i.test(rawUrl)) {
    const hlsCandidate = rawUrl.replace(/\/master\.mpd$/i, "/master.m3u8") + signedQs;
    if (await verifyHlsManifestReachable(hlsCandidate)) {
      return {
        url: hlsCandidate,
        container: "HLS",
        source: "own-pw-token",
        signatureExpireAt,
      };
    }
  }

  const fullUrl = rawUrl + signedQs;
  return {
    url: fullUrl,
    container: rawUrl.toLowerCase().includes(".m3u8") ? "HLS" : "DASH",
    source: "own-pw-token",
    signatureExpireAt,
  };
}

export async function resolveWithOwnPwTokens(params: {
  batchId: string;
  childId: string;
  videoId?: string;
}): Promise<OwnResolvedStream | null> {
  const { batchId, childId, videoId } = params;
  if (!batchId || !childId) return null;

  const now = Date.now();
  const cacheKey = `${batchId}:${childId}:${videoId || ""}`;
  const cached = resolvedStreamCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  const tokens = await getConfiguredPwTokens();
  if (tokens.length === 0) return null;

  const activeTokens = tokens.filter((t) => {
    const { expMs } = decodeJwtClaims(t);
    return !expMs || expMs > now + 60_000;
  });
  if (activeTokens.length === 0) return null;

  // Refresh batch enrollment index lazily for tokens we haven't indexed yet
  await Promise.allSettled(
    activeTokens.map((t) => {
      const idx = tokenBatchesCache.get(t);
      if (!idx || now - idx.fetchedAt >= BATCH_INDEX_TTL_MS) {
        return getTokenBatches(t).catch(() => undefined);
      }
      return Promise.resolve();
    }),
  );

  // Try enrolled tokens first, then fallback to remaining non-403 tokens
  const enrolledFirst: string[] = [];
  const otherTokens: string[] = [];
  for (const t of activeTokens) {
    const failedAt = failedBatchTokenCache.get(`${batchId}:${t}`);
    if (failedAt && now - failedAt < FAILED_BATCH_TTL_MS) continue;
    const idx = tokenBatchesCache.get(t);
    if (idx?.batchIds.has(batchId)) enrolledFirst.push(t);
    else otherTokens.push(t);
  }

  const orderedTokens = [...enrolledFirst, ...otherTokens];
  const childCandidates = videoId && videoId !== childId ? [childId, videoId] : [childId];

  for (const token of orderedTokens) {
    for (const candidateId of childCandidates) {
      try {
        const result = await fetchVideoUrlDetails(token, batchId, candidateId);
        if (result) {
          const ttlExpiry = result.signatureExpireAt
            ? Math.min(now + 2 * 3600_000, result.signatureExpireAt - 5 * 60_000)
            : now + 2 * 3600_000;
          if (ttlExpiry > now) {
            resolvedStreamCache.set(cacheKey, { result, expiresAt: ttlExpiry });
          }
          return result;
        }
      } catch {
        // Try next candidate / token
      }
    }
  }

  return null;
}

export async function getOwnPwTokensStatus(): Promise<PwTokenStatus[]> {
  const tokens = await getConfiguredPwTokens();
  const now = Date.now();

  return Promise.all(
    tokens.map(async (token): Promise<PwTokenStatus> => {
      const claims = decodeJwtClaims(token);
      const expired = Boolean(claims.expMs && claims.expMs <= now);
      if (expired) {
        return {
          preview: maskToken(token),
          userId: claims.userId,
          username: claims.username,
          expiresAt: claims.expMs ? new Date(claims.expMs).toISOString() : undefined,
          expired: true,
          valid: false,
          enrolledBatchCount: 0,
          sampleBatches: [],
          error: "Token expired",
        };
      }

      try {
        // Force refresh on explicit admin check
        tokenBatchesCache.delete(token);
        const idx = await getTokenBatches(token);
        return {
          preview: maskToken(token),
          userId: claims.userId,
          username: claims.username,
          expiresAt: claims.expMs ? new Date(claims.expMs).toISOString() : undefined,
          expired: false,
          valid: true,
          enrolledBatchCount: idx.batches.length,
          sampleBatches: idx.batches.slice(0, 6).map((b) => b.name),
        };
      } catch (err: any) {
        return {
          preview: maskToken(token),
          userId: claims.userId,
          username: claims.username,
          expiresAt: claims.expMs ? new Date(claims.expMs).toISOString() : undefined,
          expired: false,
          valid: false,
          enrolledBatchCount: 0,
          sampleBatches: [],
          error: err?.message || "Verification failed",
        };
      }
    }),
  );
}

