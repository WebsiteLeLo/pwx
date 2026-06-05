import { Router } from "express";

const proxyRouter = Router();

const CDN_HOSTS = ["sec-prod-mediacdn.pw.live", "prod-mediacdn.pw.live", "mediacdn.pw.live"];

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

proxyRouter.options(["/proxy", "/dash-seg/*path"], (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.status(204).end();
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
  const { sig, path: pathParam } = req.params as { sig: string; path: string };

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

export default proxyRouter;
