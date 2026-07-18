import { Router } from "express";

const proxyRouter = Router();

const CDN_HOSTS = [
  "sec-prod-mediacdn.pw.live",
  "prod-mediacdn.pw.live",
  "mediacdn.pw.live",
  "cloudfront.net",  // PW video CDN distributions
];
const PDF_HOSTS = ["static.pw.live", "pw.live", "cdn.pw.live", "d2bps9p1kiy4ka.cloudfront.net"];

function isAllowedCdnHost(hostname: string): boolean {
  return CDN_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

function injectBaseUrl(mpdXml: string, baseUrl: string): string {
  if (mpdXml.includes("<BaseURL>")) {
    return mpdXml.replace(/<BaseURL>.*?<\/BaseURL>/g, `<BaseURL>${baseUrl}</BaseURL>`);
  }
  return mpdXml.replace(/<Period([^>]*)>/, `<Period$1>\n    <BaseURL>${baseUrl}</BaseURL>`);
}

// Headers to try in order — each mimics a likely whitelisted referrer on PW's CloudFront WAF
const CDN_HEADER_VARIANTS = [
  {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://vidcloud.eu.org/",
    "Origin": "https://vidcloud.eu.org",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "sec-ch-ua": '"Chromium";v="124","Google Chrome";v="124"',
    "sec-ch-ua-mobile": "?0",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
  },
  {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://www.pw.live/",
    "Origin": "https://www.pw.live",
    "Accept": "*/*",
    "Accept-Language": "en-IN,en;q=0.9",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
  },
  {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "*/*",
  },
];

async function fetchCdn(url: string): Promise<{ status: number; contentType: string; buffer: ArrayBuffer }> {
  for (const headers of CDN_HEADER_VARIANTS) {
    const resp = await fetch(url, { headers });
    if (resp.status !== 403) {
      return {
        status: resp.status,
        contentType: resp.headers.get("content-type") || "application/octet-stream",
        buffer: await resp.arrayBuffer(),
      };
    }
  }
  // All variants returned 403 — return the last 403
  return { status: 403, contentType: "application/json", buffer: new ArrayBuffer(0) };
}

function isAllowedPdfHost(hostname: string): boolean {
  return PDF_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

// ── Vidcloud stream URL extractor ─────────────────────────────────────────────
// Fetches vidcloud's play.php page (which has PW auth baked in) and extracts
// any CloudFront signed MPD/HLS/M3U8 URLs embedded in the page source.
proxyRouter.get("/vidcloud-stream", async (req, res) => {
  const { batchId, subjectId, videoId } = req.query as Record<string, string>;
  if (!batchId || !videoId) {
    res.status(400).json({ error: "Missing batchId or videoId" });
    return;
  }

  const vidcloudUrl = `https://vidcloud.eu.org/play.php?batch_id=${encodeURIComponent(batchId)}&subject_id=${encodeURIComponent(subjectId || "")}&video_id=${encodeURIComponent(videoId)}&video_type=new`;

  try {
    const upstream = await fetch(vidcloudUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
        "Referer": "https://www.pw.live/",
      },
    });

    const html = await upstream.text();

    // Extract any CloudFront or CDN video URLs embedded in the page
    const patterns = [
      // Signed CloudFront URL with Policy/Signature params
      /https?:\/\/[^"'\s]+cloudfront\.net[^"'\s]*(?:\.mpd|\.m3u8|\.master)[^"'\s]*/gi,
      // Unsigned CloudFront MPD/HLS
      /https?:\/\/[^"'\s]+cloudfront\.net\/[^"'\s]+\.(?:mpd|m3u8)[^"'\s]*/gi,
      // PW CDN
      /https?:\/\/[^"'\s]+(?:pw\.live|mediacdn\.pw)[^"'\s]+\.(?:mpd|m3u8)[^"'\s]*/gi,
      // Any MPD/HLS in JSON-like strings
      /"(https?:\/\/[^"]+\.(?:mpd|m3u8)[^"]*)"/gi,
      /'(https?:\/\/[^']+\.(?:mpd|m3u8)[^']*)'/gi,
    ];

    const found = new Set<string>();
    for (const pattern of patterns) {
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(html)) !== null) {
        found.add(m[1] ?? m[0]);
      }
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      urls: [...found],
      // Also include the raw page length for debugging
      pageLength: html.length,
    });
  } catch (err) {
    req.log.error({ err }, "vidcloud-stream fetch failed");
    res.status(502).json({ error: "Failed to fetch vidcloud page" });
  }
});

// ── PW video metadata proxy (fetches from pwsecure with proper headers) ────────
proxyRouter.get("/pw-video/:videoId", async (req, res) => {
  const { videoId } = req.params as { videoId: string };
  if (!videoId) {
    res.status(400).json({ error: "Missing videoId" });
    return;
  }

  const PW_SECURE = "https://pwsecure.gourav23032009.workers.dev/api/pw";
  const url = `${PW_SECURE}/v1/videos/${encodeURIComponent(videoId)}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://www.pw.live/",
        "Origin": "https://www.pw.live",
        "Accept": "application/json, text/plain, */*",
      },
    });

    const data = await upstream.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(upstream.status).json(data);
  } catch (err) {
    req.log.error({ err }, "pw-video proxy fetch failed");
    res.status(502).json({ error: "Upstream fetch failed" });
  }
});

proxyRouter.options(["/proxy", "/pdf", "/dash-seg/*path"], (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.status(204).end();
});

proxyRouter.get("/pdf", async (req, res) => {
  const rawUrl = req.query.url as string | undefined;
  if (!rawUrl) {
    res.status(400).json({ error: "Missing url" });
    return;
  }

  let fullUrl = rawUrl;
  if (!fullUrl.startsWith("http")) fullUrl = `https://${fullUrl}`;

  let parsed: URL;
  try {
    parsed = new URL(fullUrl);
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  if (!isAllowedPdfHost(parsed.hostname)) {
    res.status(403).json({ error: "Host not allowed" });
    return;
  }

  try {
    const upstream = await fetch(fullUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PWX/1.0)",
        "Referer": "https://www.pw.live/",
        "Origin": "https://www.pw.live",
      },
    });

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Content-Disposition", "inline");
    res.status(upstream.status);

    const buf = await upstream.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch (err) {
    req.log.error({ err }, "pdf proxy fetch failed");
    res.status(502).json({ error: "Upstream fetch failed" });
  }
});

proxyRouter.get("/proxy", async (req, res) => {
  const rawUrl = req.query.url as string | undefined;
  if (!rawUrl) {
    res.status(400).json({ error: "Missing url" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  if (!isAllowedCdnHost(parsed.hostname)) {
    res.status(403).json({ error: "Host not allowed" });
    return;
  }

  try {
    const { status, contentType, buffer } = await fetchCdn(rawUrl);
    const isMpd =
      contentType.includes("dash") ||
      contentType.includes("xml") ||
      parsed.pathname.endsWith(".mpd");

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.status(status);

    if (isMpd && status < 300) {
      const mpdText = new TextDecoder().decode(buffer);

      const pathParts = parsed.pathname.split("/").filter(Boolean);
      const uuid = pathParts[0] ?? "";
      const sigQs = parsed.search.slice(1);
      const sigB64 = Buffer.from(sigQs).toString("base64url");
      const proto = req.get("x-forwarded-proto") || req.protocol;
      const host = req.get("x-forwarded-host") || req.get("host") || "";
      const baseUrl = `${proto}://${host}/api/dash-seg/${sigB64}/${uuid}/`;

      const rewritten = injectBaseUrl(mpdText, baseUrl);
      res.setHeader("Content-Type", "application/dash+xml");
      res.end(rewritten);
    } else {
      res.setHeader("Content-Type", contentType);
      res.end(Buffer.from(buffer));
    }
  } catch (err) {
    req.log.error({ err }, "proxy fetch failed");
    res.status(502).json({ error: "Upstream fetch failed" });
  }
});

proxyRouter.get("/dash-seg/:sig/*path", async (req, res) => {
  const { sig, path: pathParam } = req.params as unknown as { sig: string; path: string };

  let sigQs: string;
  try {
    sigQs = Buffer.from(sig, "base64url").toString();
  } catch {
    res.status(400).json({ error: "Invalid sig" });
    return;
  }

  const segPath = Array.isArray(pathParam) ? pathParam.join("/") : pathParam;
  const cdnUrl = `https://sec-prod-mediacdn.pw.live/${segPath}?${sigQs}`;

  let parsed: URL;
  try {
    parsed = new URL(cdnUrl);
  } catch {
    res.status(400).json({ error: "Bad segment URL" });
    return;
  }

  if (!isAllowedCdnHost(parsed.hostname)) {
    res.status(403).json({ error: "Host not allowed" });
    return;
  }

  try {
    const { status, contentType, buffer } = await fetchCdn(cdnUrl);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600, immutable");
    res.status(status);
    res.end(Buffer.from(buffer));
  } catch (err) {
    req.log.error({ err }, "dash-seg fetch failed");
    res.status(502).json({ error: "Segment fetch failed" });
  }
});

// ── RareStudy PDF proxy ──────────────────────────────────────────────────────
proxyRouter.options("/rarestudy-pdf", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.status(204).end();
});

proxyRouter.get("/rarestudy-pdf", async (req, res) => {
  const { batchId, subjectId, scheduleId, noteIndex = "0", isDpp = "false" } = req.query as Record<string, string>;

  if (!batchId || !subjectId || !scheduleId) {
    res.status(400).json({ error: "Missing required params" });
    return;
  }

  const url = `https://rarestudy.in/schedule-details?batchId=${encodeURIComponent(batchId)}&subjectId=${encodeURIComponent(subjectId)}&scheduleId=${encodeURIComponent(scheduleId)}&tap=note&noteIndex=${encodeURIComponent(noteIndex)}&isDpp=${encodeURIComponent(isDpp)}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://rarestudy.in/",
        "Origin": "https://rarestudy.in",
        "Accept": "application/json, text/plain, */*",
      },
    });

    const data = await upstream.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=1800");
    res.status(upstream.status).json(data);
  } catch (err) {
    req.log.error({ err }, "rarestudy-pdf fetch failed");
    res.status(502).json({ error: "Upstream fetch failed" });
  }
});

// ── Google Drive proxy (bypasses referrer restriction) ──────────────────────
const DRIVE_API_KEY = process.env.DRIVE_API_KEY ?? "";

proxyRouter.get("/drive/files", async (req, res) => {
  if (!DRIVE_API_KEY) {
    res.status(503).json({ error: "Drive API not configured" });
    return;
  }

  const { folderId } = req.query as { folderId?: string };
  if (!folderId) {
    res.status(400).json({ error: "Missing folderId" });
    return;
  }

  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent("files(id,name,mimeType,modifiedTime,size)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&key=${DRIVE_API_KEY}&orderBy=folder,name&pageSize=200`;

  try {
    const upstream = await fetch(url, {
      headers: {
        "Referer": "https://materialforjee.onrender.com/",
        "Origin": "https://materialforjee.onrender.com",
        "User-Agent": "Mozilla/5.0 (compatible; PWX/1.0)",
      },
    });

    const data = await upstream.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(upstream.status).json(data);
  } catch (err) {
    req.log.error({ err }, "drive proxy fetch failed");
    res.status(502).json({ error: "Drive API fetch failed" });
  }
});

export default proxyRouter;
