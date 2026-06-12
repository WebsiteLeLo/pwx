const PW_API = "https://pwsecure.gourav23032009.workers.dev/api/pw";

function isAllowedImageHost(hostname: string): boolean {
  return (
    hostname === "pw.live" ||
    hostname.endsWith(".pw.live") ||
    hostname.endsWith(".cloudfront.net") ||
    hostname === "appx.ph" ||
    hostname.endsWith(".appx.ph")
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function handleImageProxy(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawUrl = url.searchParams.get("url");
  if (!rawUrl) return new Response("Missing url", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  if (!isAllowedImageHost(parsed.hostname)) {
    return new Response("Host not allowed", { status: 403 });
  }

  try {
    const upstream = await fetch(rawUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PWX-OG/1.0)",
        "Referer": "https://www.pw.live/",
        "Origin": "https://www.pw.live",
      },
    });
    if (!upstream.ok) return new Response("Upstream error", { status: 502 });

    const ct = upstream.headers.get("content-type") ?? "image/jpeg";
    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("Fetch failed", { status: 502 });
  }
}

async function handleBatchOg(request: Request, batchId: string, env: Env): Promise<Response> {
  const workerOrigin = new URL(request.url).origin;
  const frontendOrigin = env.FRONTEND_URL ?? "https://pwx.onrender.com";
  const batchUrl = `${frontendOrigin}/batch/${batchId}`;

  let title = "PWX — JEE & NEET Video Player";
  let description = "Watch Physics Wallah batches, live classes & DPP quizzes.";
  let rawImageUrl = "https://cdn.pw.live/subjects/pwicons/PW.png";

  try {
    const r = await fetch(`${PW_API}/v3/batches/${batchId}/details`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PWX-OG/1.0)" },
    });
    if (r.ok) {
      const json: any = await r.json();
      const d = json?.data ?? {};
      if (d.name) {
        title = `${d.name} — PWX`;
        description = `Watch ${d.name} batch on PWX — JEE & NEET video lectures, live classes & DPP quizzes.`;
      }
      if (d.previewImage?.baseUrl && d.previewImage?.key) {
        rawImageUrl = `${d.previewImage.baseUrl}${d.previewImage.key}`;
      } else if (d.image?.baseUrl && d.image?.key) {
        rawImageUrl = `${d.image.baseUrl}${d.image.key}`;
      }
    }
  } catch {
    // use defaults
  }

  const proxiedImageUrl = `${workerOrigin}/og/img?url=${encodeURIComponent(rawImageUrl)}`;

  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeImage = escapeHtml(proxiedImageUrl);
  const safeUrl = escapeHtml(batchUrl);

  const html = `<!DOCTYPE html>
<html prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}" />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="${safeUrl}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:image:width" content="512" />
  <meta property="og:image:height" content="512" />
  <meta property="og:site_name" content="PWX" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
  <meta name="twitter:image" content="${safeImage}" />
</head>
<body>
  <script>window.location.replace(${JSON.stringify(batchUrl)});</script>
  <p>Redirecting… <a href="${safeUrl}">${safeTitle}</a></p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

export interface Env {
  FRONTEND_URL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/og/img") return handleImageProxy(request);

    const batchMatch = pathname.match(/^\/og\/batch\/([^/]+)$/);
    if (batchMatch) return handleBatchOg(request, batchMatch[1], env);

    return new Response("Not found", { status: 404 });
  },
};
