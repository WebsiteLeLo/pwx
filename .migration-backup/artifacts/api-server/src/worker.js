const CDN_HOSTS = ["sec-prod-mediacdn.pw.live", "prod-mediacdn.pw.live", "mediacdn.pw.live"];
const PDF_HOSTS = ["static.pw.live", "pw.live", "cdn.pw.live", "d2bps9p1kiy4ka.cloudfront.net"];
const DRIVE_API_KEY = "AIzaSyBJNDZ_fWVo04YD-_1dxpdWk2SUdmmN_6M";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

function isAllowedCdnHost(h) {
  return CDN_HOSTS.some((a) => h === a || h.endsWith(`.${a}`));
}
function isAllowedPdfHost(h) {
  return PDF_HOSTS.some((a) => h === a || h.endsWith(`.${a}`));
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...extra },
  });
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

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // Health
    if (path === "/api/healthz") {
      return json({ status: "ok" });
    }

    // PDF proxy
    if (path === "/api/pdf") {
      const rawUrl = url.searchParams.get("url");
      if (!rawUrl) return json({ error: "Missing url" }, 400);
      const fullUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
      let parsed;
      try { parsed = new URL(fullUrl); } catch { return json({ error: "Invalid URL" }, 400); }
      if (!isAllowedPdfHost(parsed.hostname)) return json({ error: "Host not allowed" }, 403);
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
            ...CORS,
            "Content-Type": "application/pdf",
            "Cache-Control": "public, max-age=3600",
            "Content-Disposition": "inline",
          },
        });
      } catch { return json({ error: "Upstream fetch failed" }, 502); }
    }

    // MPD proxy
    if (path === "/api/proxy") {
      const rawUrl = url.searchParams.get("url");
      if (!rawUrl) return json({ error: "Missing url" }, 400);
      let parsed;
      try { parsed = new URL(rawUrl); } catch { return json({ error: "Invalid URL" }, 400); }
      if (!isAllowedCdnHost(parsed.hostname)) return json({ error: "Host not allowed" }, 403);
      try {
        const { status, contentType, buffer } = await fetchCdn(rawUrl);
        const isMpd = contentType.includes("dash") || contentType.includes("xml") || parsed.pathname.endsWith(".mpd");
        if (isMpd && status < 300) {
          const mpdText = new TextDecoder().decode(buffer);
          const uuid = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
          const sigB64 = toBase64url(parsed.search.slice(1));
          const baseUrl = `${url.protocol}//${url.host}/api/dash-seg/${sigB64}/${uuid}/`;
          return new Response(injectBaseUrl(mpdText, baseUrl), {
            status,
            headers: { ...CORS, "Content-Type": "application/dash+xml" },
          });
        }
        return new Response(buffer, { status, headers: { ...CORS, "Content-Type": contentType } });
      } catch { return json({ error: "Upstream fetch failed" }, 502); }
    }

    // DASH segment proxy  (/api/dash-seg/:sig/rest/of/path)
    const dashMatch = path.match(/^\/api\/dash-seg\/([^/]+)\/(.+)$/);
    if (dashMatch) {
      const [, sig, segPath] = dashMatch;
      let sigQs;
      try { sigQs = fromBase64url(sig); } catch { return json({ error: "Invalid sig" }, 400); }
      const cdnUrl = `https://sec-prod-mediacdn.pw.live/${segPath}?${sigQs}`;
      let parsed;
      try { parsed = new URL(cdnUrl); } catch { return json({ error: "Bad segment URL" }, 400); }
      if (!isAllowedCdnHost(parsed.hostname)) return json({ error: "Host not allowed" }, 403);
      try {
        const { status, contentType, buffer } = await fetchCdn(cdnUrl);
        return new Response(buffer, {
          status,
          headers: { ...CORS, "Content-Type": contentType, "Cache-Control": "public, max-age=300" },
        });
      } catch { return json({ error: "Segment fetch failed" }, 502); }
    }

    // Google Drive files
    if (path === "/api/drive/files") {
      const folderId = url.searchParams.get("folderId");
      if (!folderId) return json({ error: "Missing folderId" }, 400);
      const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
      const fields = encodeURIComponent("files(id,name,mimeType,modifiedTime,size)");
      const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&key=${DRIVE_API_KEY}&orderBy=folder,name&pageSize=200`;
      try {
        const upstream = await fetch(driveUrl, {
          headers: {
            "Referer": "https://materialforjee.onrender.com/",
            "Origin": "https://materialforjee.onrender.com",
            "User-Agent": "Mozilla/5.0 (compatible; PWX/1.0)",
          },
        });
        const data = await upstream.json();
        return new Response(JSON.stringify(data), {
          status: upstream.status,
          headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
        });
      } catch { return json({ error: "Drive API fetch failed" }, 502); }
    }

    return json({ error: "Not found" }, 404);
  },
};
