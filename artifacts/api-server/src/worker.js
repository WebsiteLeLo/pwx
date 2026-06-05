import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

const CDN_HOSTS = ["sec-prod-mediacdn.pw.live", "prod-mediacdn.pw.live", "mediacdn.pw.live"];
const PDF_HOSTS = ["static.pw.live", "pw.live", "cdn.pw.live", "d2bps9p1kiy4ka.cloudfront.net"];

function isAllowedCdnHost(h) {
  return CDN_HOSTS.some((a) => h === a || h.endsWith(`.${a}`));
}
function isAllowedPdfHost(h) {
  return PDF_HOSTS.some((a) => h === a || h.endsWith(`.${a}`));
}

function injectBaseUrl(mpdXml, baseUrl) {
  if (mpdXml.includes("<BaseURL>"))
    return mpdXml.replace(/<BaseURL>.*?<\/BaseURL>/g, `<BaseURL>${baseUrl}</BaseURL>`);
  return mpdXml.replace(/<Period([^>]*)>/, `<Period$1>\n    <BaseURL>${baseUrl}</BaseURL>`);
}

async function fetchCdn(url) {
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

function toBase64url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromBase64url(b64) {
  const std = b64.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(std);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

app.use("*", cors({ origin: "*", allowMethods: ["GET", "HEAD", "OPTIONS"] }));

app.get("/api/healthz", (c) => c.json({ status: "ok" }));

app.get("/api/pdf", async (c) => {
  const rawUrl = c.req.query("url");
  if (!rawUrl) return c.json({ error: "Missing url" }, 400);

  let fullUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  let parsed;
  try { parsed = new URL(fullUrl); } catch { return c.json({ error: "Invalid URL" }, 400); }
  if (!isAllowedPdfHost(parsed.hostname)) return c.json({ error: "Host not allowed" }, 403);

  try {
    const upstream = await fetch(fullUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PWX/1.0)",
        "Referer": "https://www.pw.live/",
        "Origin": "https://www.pw.live",
      },
    });
    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/pdf",
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return c.json({ error: "Upstream fetch failed" }, 502);
  }
});

app.get("/api/proxy", async (c) => {
  const rawUrl = c.req.query("url");
  if (!rawUrl) return c.json({ error: "Missing url" }, 400);

  let parsed;
  try { parsed = new URL(rawUrl); } catch { return c.json({ error: "Invalid URL" }, 400); }
  if (!isAllowedCdnHost(parsed.hostname)) return c.json({ error: "Host not allowed" }, 403);

  try {
    const { status, contentType, buffer } = await fetchCdn(rawUrl);
    const isMpd =
      contentType.includes("dash") ||
      contentType.includes("xml") ||
      parsed.pathname.endsWith(".mpd");

    if (isMpd && status < 300) {
      const mpdText = new TextDecoder().decode(buffer);
      const uuid = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
      const sigB64 = toBase64url(parsed.search.slice(1));
      const reqUrl = new URL(c.req.url);
      const baseUrl = `${reqUrl.protocol}//${reqUrl.host}/api/dash-seg/${sigB64}/${uuid}/`;
      return new Response(injectBaseUrl(mpdText, baseUrl), {
        status,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Content-Type": "application/dash+xml",
        },
      });
    }

    return new Response(buffer, {
      status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Content-Type": contentType,
      },
    });
  } catch {
    return c.json({ error: "Upstream fetch failed" }, 502);
  }
});

app.get("/api/dash-seg/:sig/*", async (c) => {
  const sig = c.req.param("sig");
  const prefix = `/api/dash-seg/${sig}/`;
  const segPath = c.req.path.slice(prefix.length);

  let sigQs;
  try { sigQs = fromBase64url(sig); } catch { return c.json({ error: "Invalid sig" }, 400); }

  const cdnUrl = `https://sec-prod-mediacdn.pw.live/${segPath}?${sigQs}`;
  let parsed;
  try { parsed = new URL(cdnUrl); } catch { return c.json({ error: "Bad segment URL" }, 400); }
  if (!isAllowedCdnHost(parsed.hostname)) return c.json({ error: "Host not allowed" }, 403);

  try {
    const { status, contentType, buffer } = await fetchCdn(cdnUrl);
    return new Response(buffer, {
      status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return c.json({ error: "Segment fetch failed" }, 502);
  }
});

const DRIVE_API_KEY = "AIzaSyBJNDZ_fWVo04YD-_1dxpdWk2SUdmmN_6M";

app.get("/api/drive/files", async (c) => {
  const folderId = c.req.query("folderId");
  if (!folderId) return c.json({ error: "Missing folderId" }, 400);

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
    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300",
        "Content-Type": "application/json",
      },
    });
  } catch {
    return c.json({ error: "Drive API fetch failed" }, 502);
  }
});

export default app;
