// Cloudflare Pages Function: High-performance edge proxy for CloudFront / CDN streams
// Streams video chunks directly at the edge with 0 bandwidth usage on your Render backend server.

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

  // 2. Recombine any query parameters that were separated by query parsing (Signature, Policy, Key-Pair-Id)
  const extraParams = new URLSearchParams();
  for (const [key, value] of reqUrl.searchParams.entries()) {
    if (key !== "url" && !targetUrl.includes(key + "=")) {
      extraParams.set(key, value);
    }
  }
  const extraStr = extraParams.toString();
  if (extraStr) {
    targetUrl += (targetUrl.includes("?") ? "&" : "?") + extraStr;
  }

  // 3. Build upstream headers mimicking whitelisted PW.live origin
  const upstreamHeaders = new Headers();
  upstreamHeaders.set(
    "User-Agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );
  upstreamHeaders.set("Origin", "https://www.pw.live");
  upstreamHeaders.set("Referer", "https://www.pw.live/");
  upstreamHeaders.set("Accept", "*/*");

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

    const isMpd =
      targetUrl.includes(".mpd") ||
      targetUrl.includes(".m3u8") ||
      targetUrl.includes(".xml");

    // If MPD manifest, inject BaseURL
    if (isMpd && upstream.status < 300) {
      const text = await upstream.text();
      const basePath = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);
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
          "Cache-Control": "no-cache",
        },
      });
    }

    // For video segments (.mp4, .m4s, .ts), stream directly from CloudFront to the browser
    const respHeaders = new Headers(upstream.headers);
    respHeaders.set("Access-Control-Allow-Origin", "*");
    respHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
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

