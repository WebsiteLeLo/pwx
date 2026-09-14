export default {
  async fetch(request, env, ctx) {
    // Only handle GET requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      return new Response("Missing url parameter", { status: 400 });
    }

    let parsedTarget;
    try {
      parsedTarget = new URL(targetUrl);
    } catch (e) {
      return new Response("Invalid URL parameter", { status: 400 });
    }

    // Set up headers to spoof origin/referer to bypass WAF/CORS
    const headers = new Headers();
    headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    headers.set("Accept", "*/*");
    headers.set("Accept-Language", "en-US,en;q=0.9");
    
    // Add specific spoofing based on CDN
    if (parsedTarget.hostname.includes("pw.live") || parsedTarget.hostname.includes("cloudfront.net")) {
      headers.set("Origin", "https://www.pw.live");
      headers.set("Referer", "https://www.pw.live/");
    } else if (parsedTarget.hostname.includes("herokuapp.com")) {
      headers.set("Origin", "https://vidcloud.eu.org");
      headers.set("Referer", "https://vidcloud.eu.org/");
    }

    try {
      let upstreamResponse = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
      });

      // Fallback for strict WAFs (if 403, try without Referer or with different Origin)
      if (upstreamResponse.status === 403 && parsedTarget.hostname.includes("herokuapp.com")) {
        headers.delete("Origin");
        headers.delete("Referer");
        upstreamResponse = await fetch(targetUrl, {
          method: request.method,
          headers: headers,
        });
      }

      const responseHeaders = new Headers(upstreamResponse.headers);
      
      // Inject CORS headers so the browser allows the response
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      responseHeaders.set("Access-Control-Expose-Headers", "Content-Length, Content-Range");

      // Handle MPD files: inject the original base URL so segments resolve correctly
      const contentType = responseHeaders.get("content-type") || "";
      const isMpd = contentType.includes("dash") || contentType.includes("xml") || targetUrl.endsWith(".mpd");

      if (isMpd && upstreamResponse.status < 300) {
        let mpdText = await upstreamResponse.text();
        responseHeaders.set("Content-Type", "application/dash+xml");

        // Extract base path (e.g., https://host/path/)
        const basePath = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);
        
        // Inject BaseURL exactly like our local api-server does
        if (mpdText.includes("<BaseURL>")) {
          mpdText = mpdText.replace(/<BaseURL>.*?<\/BaseURL>/g, `<BaseURL>${basePath}</BaseURL>`);
        } else {
          mpdText = mpdText.replace(/<Period([^>]*)>/, `<Period$1>\n    <BaseURL>${basePath}</BaseURL>`);
        }

        return new Response(mpdText, {
          status: upstreamResponse.status,
          headers: responseHeaders,
        });
      }

      // Return streaming response for video segments directly from Edge
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response("Error fetching upstream", { status: 502 });
    }
  },
};
