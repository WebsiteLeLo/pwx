import { Router } from "express";

const proxyRouter = Router();

const CDN_HOSTS = ["sec-prod-mediacdn.pw.live", "prod-mediacdn.pw.live", "mediacdn.pw.live"];
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

async function fetchCdn(url: string): Promise<{ status: number; contentType: string; buffer: ArrayBuffer }> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PWX/1.0)",
      "Referer": "https://www.pw.live/",
      "Origin": "https://www.pw.live",
    },
  });
  return {
    status: resp.status,
    contentType: resp.headers.get("content-type") || "application/octet-stream",
    buffer: await resp.arrayBuffer(),
  };
}

function isAllowedPdfHost(hostname: string): boolean {
  return PDF_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

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
      const baseUrl = `/api/dash-seg/${sigB64}/${uuid}/`;

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
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(status);
    res.end(Buffer.from(buffer));
  } catch (err) {
    req.log.error({ err }, "dash-seg fetch failed");
    res.status(502).json({ error: "Segment fetch failed" });
  }
});

// ── Google Drive proxy (bypasses referrer restriction) ──────────────────────
const DRIVE_API_KEY = "AIzaSyBJNDZ_fWVo04YD-_1dxpdWk2SUdmmN_6M";

proxyRouter.get("/drive/files", async (req, res) => {
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
