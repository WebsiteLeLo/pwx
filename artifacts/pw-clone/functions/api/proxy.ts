// Cloudflare Pages Function: High-performance edge proxy for CloudFront / CDN streams
// Streams video chunks directly at the edge with 0 bandwidth usage on your Render backend server.

function rewriteM3u8Manifest(manifestText: string, baseHref: string): string {
  return manifestText
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_m, uri) => {
          try {
            return `URI="${new URL(uri, baseHref).href}"`;
          } catch {
            return `URI="${uri}"`;
          }
        });
      }
      try {
        return new URL(trimmed, baseHref).href;
      } catch {
        return line;
      }
    })
    .join("\n");
}

export async function onRequest(context: { request: Request }): Promise<Response> {
  const req = context.request;

  // 1. Handle CORS Preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const reqUrl = new URL(req.url);
  if (reqUrl.searchParams.get("ping") === "1") {
    return new Response(JSON.stringify({ ok: true, service: "pwx-video-proxy" }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      },
    });
  }

  let targetUrl = reqUrl.searchParams.get("url");

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "Missing url parameter" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const cookieOverride = reqUrl.searchParams.get("ck")?.trim() || "";

  // 2. Recombine any query parameters that were separated by query parsing (Signature, Policy, Key-Pair-Id)
  const extraParams = new URLSearchParams();
  for (const [key, value] of reqUrl.searchParams.entries()) {
    if (key !== "url" && key !== "ck" && !targetUrl.includes(key + "=")) {
      extraParams.set(key, value);
    }
  }
  const extraStr = extraParams.toString();
  if (extraStr) {
    targetUrl += (targetUrl.includes("?") ? "&" : "?") + extraStr;
  }

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid url parameter" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const useTargetOrigin =
    Boolean(cookieOverride) ||
    parsedTarget.hostname.includes("pwmarco") ||
    parsedTarget.pathname.includes("/recorded-stream/");
  const upstreamOrigin = useTargetOrigin ? parsedTarget.origin : "https://www.pw.live";

  // 3. Build upstream headers mimicking whitelisted origin
  const upstreamHeaders = new Headers();
  upstreamHeaders.set(
    "User-Agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );
  upstreamHeaders.set("Origin", upstreamOrigin);
  upstreamHeaders.set("Referer", `${upstreamOrigin}/`);
  upstreamHeaders.set("Accept", "*/*");
  if (cookieOverride) {
    upstreamHeaders.set("Cookie", cookieOverride);
  }

  // Pass Range header for video seeking & chunking
  const range = req.headers.get("Range");
  if (range) {
    upstreamHeaders.set("Range", range);
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: upstreamHeaders,
      redirect: "follow",
    });

    const contentType = (upstream.headers.get("content-type") || "").toLowerCase();
    const lowerPath = parsedTarget.pathname.toLowerCase();
    const isDashManifest =
      lowerPath.endsWith(".mpd") ||
      lowerPath.endsWith(".xml") ||
      contentType.includes("dash+xml");
    const isHlsManifest =
      lowerPath.endsWith(".m3u8") ||
      contentType.includes("mpegurl");

    // If MPD manifest, inject BaseURL
    if (isDashManifest && upstream.status < 300) {
      const text = await upstream.text();
      const rawNoQuery = targetUrl.split("?")[0];
      const basePath = rawNoQuery.substring(0, rawNoQuery.lastIndexOf("/") + 1);
      let rewritten = text;
      if (text.includes("<BaseURL>")) {
        rewritten = text.replace(/<BaseURL>.*?<\/BaseURL>/g, `<BaseURL>${basePath}</BaseURL>`);
      } else {
        rewritten = text.replace(/<Period([^>]*)>/, `<Period$1>\n    <BaseURL>${basePath}</BaseURL>`);
      }

      return new Response(rewritten, {
        status: upstream.status,
        headers: {
          "Content-Type": "application/dash+xml",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Cache-Control": "no-cache",
        },
      });
    }

    // If HLS M3U8 manifest, absolutize relative segment/key URLs
    if (isHlsManifest && upstream.status < 300) {
      const text = await upstream.text();
      const rewritten = rewriteM3u8Manifest(text, parsedTarget.href);

      return new Response(rewritten, {
        status: upstream.status,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Cache-Control": "no-cache",
        },
      });
    }

    // For video segments (.mp4, .m4s, .ts), stream directly from upstream to the browser
    const respHeaders = new Headers(upstream.headers);
    respHeaders.set("Access-Control-Allow-Origin", "*");
    respHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    respHeaders.set("Access-Control-Allow-Headers", "*");
    respHeaders.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
    respHeaders.delete("x-frame-options");
    respHeaders.delete("content-security-policy");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: respHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Upstream fetch failed", details: String(err?.message || err) }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}

