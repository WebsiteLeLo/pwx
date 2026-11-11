import { Router } from "express";
import { Readable } from "node:stream";
import { db, siteSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { resolvePdfKey, getResolverDiagnostics } from "../lib/pdfResolver";
import { resolveStreamWithVidcloud } from "../lib/streamResolver";

const proxyRouter = Router();

export async function getPwApiUrl() {
  try {
    const [setting] = await db
      .select()
      .from(siteSettingsTable)
      .where(eq(siteSettingsTable.key, "pw_api_url"));
    return (setting?.value as string) || "https://pwsecure.gourav23032009.workers.dev/api/pw";
  } catch (e) {
    return "https://pwsecure.gourav23032009.workers.dev/api/pw";
  }
}

const CDN_HOSTS = [
  "sec-prod-mediacdn.pw.live",
  "prod-mediacdn.pw.live",
  "mediacdn.pw.live",
  "cloudfront.net",          // PW video CDN distributions
  "proxy.primestudy.site",   // learnbyakp stream proxy
  "herokuapp.com",           // devcoderz video stream host
  "streamvideo.co.in",       // stream.testuk.org DASH CDN
  "stream.testuk.org",       // video-url-details API host
];
const PDF_HOSTS = ["static.pw.live", "pw.live", "cdn.pw.live", "d2bps9p1kiy4ka.cloudfront.net", "testwave.cc"];

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
const CDN_HEADER_VARIANTS: Record<string, string>[] = [
  {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://stream.testuk.org/",
    "Origin": "https://stream.testuk.org",
    "Accept": "*/*",
    "Accept-Language": "en-IN,en;q=0.9",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
  },
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
  const variants = url.includes("cloudfront.net")
    ? [CDN_HEADER_VARIANTS[2], CDN_HEADER_VARIANTS[0], CDN_HEADER_VARIANTS[1], CDN_HEADER_VARIANTS[3]]
    : CDN_HEADER_VARIANTS;

  for (const headers of variants) {
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

// ── stream.testuk.org  /v1/videos/video-url-details proxy ───────────────────
// The player's boot() calls this relative URL. We forward it to stream.testuk.org
// with spoofed browser headers so Cloudflare's WAF lets the request through.
proxyRouter.options("/v1/videos/video-url-details", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.status(204).end();
});

proxyRouter.get("/v1/videos/video-url-details", async (req, res) => {
  const { mediaToken, videoContainerType } = req.query as Record<string, string>;
  if (!mediaToken) {
    res.status(400).json({ success: false, message: "mediaToken is required" });
    return;
  }

  const qs = new URLSearchParams({ mediaToken, videoContainerType: videoContainerType || "DASH" });
  const upstream = `https://stream.testuk.org/v1/videos/video-url-details?${qs}`;

  const STREAM_HEADER_VARIANTS: Record<string, string>[] = [
    {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Referer": "https://stream.testuk.org/",
      "Origin": "https://stream.testuk.org",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-IN,en;q=0.9",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
    },
    {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Referer": "https://testuk.org/",
      "Origin": "https://testuk.org",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-IN,en;q=0.9",
    },
    {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Referer": "https://www.pw.live/",
      "Origin": "https://www.pw.live",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-IN,en;q=0.9",
    },
    {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json, */*",
    },
  ];

  try {
    let lastStatus = 403;
    for (const headers of STREAM_HEADER_VARIANTS) {
      const resp = await fetch(upstream, { headers, redirect: "manual" });
      lastStatus = resp.status;
      if (resp.status === 200) {
        const data = await resp.json();
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cache-Control", "no-store");
        res.status(200).json(data);
        return;
      }
    }

    // When upstream redirects to /keygenerate (302) or returns 403 (due to access key requirement):
    // Check known token mappings or resolve ClearKey
    if (lastStatus === 302 || lastStatus === 403) {
      if (mediaToken.startsWith("8Sbf0Y2UObtsy34z3TA4p1T3sRpXqNVMULMMrc2zr0E5ZGv")) {
        const streamUrl = "https://streamvideo.co.in/stream/l9MyqkGoXW6dT5guYqkqKK58QhZQkkkg8dFFgUTbuNd5pS4vzL-JjY93T8KzOZNlVKv404Ygczroulq5PioKuDSBDiZFlbHz0QfoG86m2imNSJy6X-5lb9lpKv_1lCcLuR1DmMpoTJebfbpSENEIRsIY74runkDkt0Z27brwny_XA5e03soUfCQ2WmUeUfqy-L8WbsIl-sp0yE4PPSV7Tbj-ZZknLPFrrTP5bR02j7bCx680P6JAPOl7tubU4MzvtMr11mBhrQ1hgo-ZxeBDt8evdaw67BVvK2gxIgw2jWXdgaRt03oqtwyKPK39iklRSYVhwfNyJUzqvmC6wbO-4GuthI02S4mkqWCJ8Cit3XUG9evi6GrCxKCaAz6nFo-p4ts3VjDQuwtFxqRDRbryndV2MlCLF0KzxGf-sZ7qncEm3AXwBK3dN7afJbxbh1NBshcApb8lqM4G2JBdWn12yXA049JEMKVT2wznNeIi121obYVA-G5uuVuEnbl6yKdIuuD7LNWSZVDCe4yBMRMEjlKar7Hq905bPad3dMLOSyHmYLik0CQaEKSfKxuPzv4ysJBYXT8N9LXs5V6cbBgoPE5lnzbr2AK6ZrunVEeHUaeXKxQ66rshW-_QBNN7lDRF0-x7OK2lwJ3irvWvsOAM-zvK48qWE_wDXuqov2f1v9r0F6-TLhDW25g1rSlPAGoI5H9VJUkoPKXYT6gYSZHf_OvTwZWXE3wxeZ9o7i6Y2tuHHZWRqY2rsOxVkoZloudsxOZochc8pAvUv_ZTBY_6u92vd4DxyrwPfcD5U-E2wjTfnQo-Jpi7vVvbnX_2E02XhxsLgzLdF4SWRP8_fpAe2eFlb7F8Ou7lJoEpaJxauKngZXDRDo1sP8NyzZ5dKfY_YLgsEAmxAMuN2o-iF-8TEVGRfWuQHuLJhVl60h9Efk2GfP1kLT_F7tb-llaPBd_jqG4Ky1-Pkj6bwQtnrQEIMO8DoKfP_o2aHiLUV4dinPU/master.mpd";
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cache-Control", "public, max-age=3600");
        res.json({
          success: true,
          data: {
            url: streamUrl,
            clearKeys: {
              "c3309b3c8adb80a4a32500aac3e11e2d": "eda5ec0a3989ac1fb0c955cbcde72e10",
            },
          },
          keys: {
            "c3309b3c8adb80a4a32500aac3e11e2d": "eda5ec0a3989ac1fb0c955cbcde72e10",
          },
        });
        return;
      }
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(lastStatus).json({
      success: false,
      message: "Video unavailable — access key verification required on stream.testuk.org or token expired.",
    });
  } catch (err) {
    req.log.error({ err }, "video-url-details proxy failed");
    res.status(502).json({ success: false, message: "Failed to reach video server" });
  }
});

// ── streamvideo.co.in MPD / segment proxy ────────────────────────────────────
// streamvideo.co.in is blocked by Cloudflare for our server IP, so we route
// manifest and segment requests through this proxy with spoofed referer headers.
const STREAMVIDEO_HOST = "streamvideo.co.in";

proxyRouter.options("/streamvideo-proxy", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.status(204).end();
});

proxyRouter.get("/streamvideo-proxy", async (req, res) => {
  const rawUrl = req.query.url as string | undefined;
  if (!rawUrl) {
    res.status(400).json({ error: "Missing url param" });
    return;
  }

  let fullUrl = rawUrl;
  if (!fullUrl.startsWith("http")) fullUrl = `https://${STREAMVIDEO_HOST}/${fullUrl.replace(/^\//, "")}`;

  let parsed: URL;
  try {
    parsed = new URL(fullUrl);
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  if (parsed.hostname !== STREAMVIDEO_HOST) {
    res.status(403).json({ error: `Only ${STREAMVIDEO_HOST} is allowed via this route` });
    return;
  }

  const STREAMVIDEO_HEADERS: Record<string, string>[] = [
    {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Referer": "https://stream.testuk.org/",
      "Origin": "https://stream.testuk.org",
      "Accept": "*/*",
      "Accept-Language": "en-IN,en;q=0.9",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "cross-site",
    },
    {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Referer": "https://testuk.org/",
      "Origin": "https://testuk.org",
      "Accept": "*/*",
      "Accept-Language": "en-IN,en;q=0.9",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "cross-site",
    },
    {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Referer": "https://www.pw.live/",
      "Origin": "https://www.pw.live",
      "Accept": "*/*",
    },
    {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "*/*",
    },
  ];

  const isMpd = fullUrl.includes(".mpd") || fullUrl.includes(".m3u8");

  try {
    let upstream: Response | null = null;
    for (const headers of STREAMVIDEO_HEADERS) {
      const resp = await fetch(fullUrl, { headers });
      if (resp.status !== 403) { upstream = resp; break; }
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");

    if (!upstream) {
      res.status(403).json({ error: "streamvideo.co.in blocked all header variants" });
      return;
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    res.status(upstream.status);
    res.setHeader("Content-Type", isMpd ? "application/dash+xml" : contentType);
    if (!isMpd) res.setHeader("Cache-Control", "public, max-age=3600");
    else res.setHeader("Cache-Control", "no-cache");

    if (isMpd) {
      const mpdText = new TextDecoder().decode(await upstream.arrayBuffer());
      // Rewrite BaseURL so segments are routed through this proxy
      const basePath = fullUrl.substring(0, fullUrl.lastIndexOf("/") + 1);
      const proxyBase = `/api/streamvideo-proxy?url=${encodeURIComponent(basePath)}`;
      const rewritten = injectBaseUrl(mpdText, basePath); // keep absolute for direct fetch
      res.end(rewritten);
    } else {
      const cl = upstream.headers.get("content-length");
      if (cl) res.setHeader("Content-Length", cl);
      if (upstream.body) {
        Readable.fromWeb(upstream.body as any).pipe(res);
      } else {
        res.end(Buffer.from(await upstream.arrayBuffer()));
      }
    }
  } catch (err) {
    req.log.error({ err, url: fullUrl }, "streamvideo-proxy fetch failed");
    if (!res.headersSent) res.status(502).json({ error: "Upstream fetch failed" });
  }
});

// ── Dynamic Stream Cache & Resolver ────────────────────────────────────────────
const STREAM_CACHE = new Map<string, { url: string; clearKeys: Record<string, string> }>([
  [
    "6ace17557f34f9fab31d7912", // Alternating Current 09 Resonance
    {
      url: "https://streamvideo.co.in/stream/l9MyqkGoXW6dT5guYqkqKK58QhZQkkkg8dFFgUTbuNd5pS4vzL-JjY93T8KzOZNlVKv404Ygczroulq5PioKuDSBDiZFlbHz0QfoG86m2imNSJy6X-5lb9lpKv_1lCcLuR1DmMpoTJebfbpSENEIRsIY74runkDkt0Z27brwny_XA5e03soUfCQ2WmUeUfqy-L8WbsIl-sp0yE4PPSV7Tbj-ZZknLPFrrTP5bR02j7bCx680P6JAPOl7tubU4MzvtMr11mBhrQ1hgo-ZxeBDt8evdaw67BVvK2gxIgw2jWXdgaRt03oqtwyKPK39iklRSYVhwfNyJUzqvmC6wbO-4GuthI02S4mkqWCJ8Cit3XUG9evi6GrCxKCaAz6nFo-p4ts3VjDQuwtFxqRDRbryndV2MlCLF0KzxGf-sZ7qncEm3AXwBK3dN7afJbxbh1NBshcApb8lqM4G2JBdWn12yXA049JEMKVT2wznNeIi121obYVA-G5uuVuEnbl6yKdIuuD7LNWSZVDCe4yBMRMEjlKar7Hq905bPad3dMLOSyHmYLik0CQaEKSfKxuPzv4ysJBYXT8N9LXs5V6cbBgoPE5lnzbr2AK6ZrunVEeHUaeXKxQ66rshW-_QBNN7lDRF0-x7OK2lwJ3irvWvsOAM-zvK48qWE_wDXuqov2f1v9r0F6-TLhDW25g1rSlPAGoI5H9VJUkoPKXYT6gYSZHf_OvTwZWXE3wxeZ9o7i6Y2tuHHZWRqY2rsOxVkoZloudsxOZochc8pAvUv_ZTBY_6u92vd4DxyrwPfcD5U-E2wjTfnQo-Jpi7vVvbnX_2E02XhxsLgzLdF4SWRP8_fpAe2eFlb7F8Ou7lJoEpaJxauKngZXDRDo1sP8NyzZ5dKfY_YLgsEAmxAMuN2o-iF-8TEVGRfWuQHuLJhVl60h9Efk2GfP1kLT_F7tb-llaPBd_jqG4Ky1-Pkj6bwQtnrQEIMO8DoKfP_o2aHiLUV4dinPU/master.mpd",
      clearKeys: {
        "c3309b3c8adb80a4a32500aac3e11e2d": "eda5ec0a3989ac1fb0c955cbcde72e10"
      }
    }
  ]
]);

// Endpoint to save or resolve a stream URL/mediaToken dynamically
proxyRouter.post("/save-stream", async (req, res) => {
  const { childId, mediaToken, streamUrl, clearKeys } = req.body || {};
  if (!childId) {
    res.status(400).json({ success: false, message: "childId is required" });
    return;
  }

  let finalUrl = streamUrl;
  let finalKeys = clearKeys || {};

  // If a mediaToken or URL containing mediaToken was supplied, resolve
  let token = mediaToken;
  if (!token && streamUrl && streamUrl.includes("mediaToken=")) {
    try {
      const u = new URL(streamUrl);
      token = u.searchParams.get("mediaToken");
    } catch {}
  }

  if (token) {
    if (token.startsWith("8Sbf0Y2UObtsy34z3TA4p1T3sRpXqNVMULMMrc2zr0E5ZGv")) {
      finalUrl = "https://streamvideo.co.in/stream/l9MyqkGoXW6dT5guYqkqKK58QhZQkkkg8dFFgUTbuNd5pS4vzL-JjY93T8KzOZNlVKv404Ygczroulq5PioKuDSBDiZFlbHz0QfoG86m2imNSJy6X-5lb9lpKv_1lCcLuR1DmMpoTJebfbpSENEIRsIY74runkDkt0Z27brwny_XA5e03soUfCQ2WmUeUfqy-L8WbsIl-sp0yE4PPSV7Tbj-ZZknLPFrrTP5bR02j7bCx680P6JAPOl7tubU4MzvtMr11mBhrQ1hgo-ZxeBDt8evdaw67BVvK2gxIgw2jWXdgaRt03oqtwyKPK39iklRSYVhwfNyJUzqvmC6wbO-4GuthI02S4mkqWCJ8Cit3XUG9evi6GrCxKCaAz6nFo-p4ts3VjDQuwtFxqRDRbryndV2MlCLF0KzxGf-sZ7qncEm3AXwBK3dN7afJbxbh1NBshcApb8lqM4G2JBdWn12yXA049JEMKVT2wznNeIi121obYVA-G5uuVuEnbl6yKdIuuD7LNWSZVDCe4yBMRMEjlKar7Hq905bPad3dMLOSyHmYLik0CQaEKSfKxuPzv4ysJBYXT8N9LXs5V6cbBgoPE5lnzbr2AK6ZrunVEeHUaeXKxQ66rshW-_QBNN7lDRF0-x7OK2lwJ3irvWvsOAM-zvK48qWE_wDXuqov2f1v9r0F6-TLhDW25g1rSlPAGoI5H9VJUkoPKXYT6gYSZHf_OvTwZWXE3wxeZ9o7i6Y2tuHHZWRqY2rsOxVkoZloudsxOZochc8pAvUv_ZTBY_6u92vd4DxyrwPfcD5U-E2wjTfnQo-Jpi7vVvbnX_2E02XhxsLgzLdF4SWRP8_fpAe2eFlb7F8Ou7lJoEpaJxauKngZXDRDo1sP8NyzZ5dKfY_YLgsEAmxAMuN2o-iF-8TEVGRfWuQHuLJhVl60h9Efk2GfP1kLT_F7tb-llaPBd_jqG4Ky1-Pkj6bwQtnrQEIMO8DoKfP_o2aHiLUV4dinPU/master.mpd";
      finalKeys = { "c3309b3c8adb80a4a32500aac3e11e2d": "eda5ec0a3989ac1fb0c955cbcde72e10" };
    } else {
      try {
        const upstream = `https://stream.testuk.org/v1/videos/video-url-details?mediaToken=${encodeURIComponent(token)}&videoContainerType=DASH`;
        const STREAM_HEADER_VARIANTS: Record<string, string>[] = [
          {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Referer": "https://stream.testuk.org/",
            "Origin": "https://stream.testuk.org",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-IN,en;q=0.9",
          },
          {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Referer": "https://testuk.org/",
            "Origin": "https://testuk.org",
            "Accept": "application/json, text/plain, */*",
          }
        ];
        for (const headers of STREAM_HEADER_VARIANTS) {
          const r = await fetch(upstream, { headers, redirect: "manual" });
          if (r.status === 200) {
            const d = (await r.json()) as any;
            if (d?.data?.url) {
              finalUrl = d.data.url;
              finalKeys = d.data.clearKeys || d.data.keys || {};
              break;
            }
          }
        }
      } catch (e: any) {
        req.log.error({ err: e }, "Failed to resolve mediaToken in save-stream");
      }
    }
  }

  // If user pasted a streamvideo.co.in link or raw URL
  if (!finalUrl && streamUrl) {
    finalUrl = streamUrl;
  }

  if (finalUrl) {
    STREAM_CACHE.set(childId, { url: finalUrl, clearKeys: finalKeys });
    res.json({ success: true, data: { url: finalUrl, clearKeys: finalKeys } });
  } else {
    res.status(400).json({ success: false, message: "Could not resolve stream URL" });
  }
});

// ── pwmarco video URL proxy ───────────────────────────────────────────────────
proxyRouter.get("/pwmarco-video-url", async (req, res) => {
  const { batchId, childId, subjectId } = req.query as Record<string, string>;

  // Check cached / known streams
  if (childId && STREAM_CACHE.has(childId)) {
    const cached = STREAM_CACHE.get(childId)!;
    res.json({
      success: true,
      data: {
        url: cached.url,
        clearKeys: cached.clearKeys
      }
    });
    return;
  }

  const url = `https://m.pwmarco.site/api/get-video-url?batchId=${batchId}&childId=${childId}&subjectId=${subjectId}&urlType=penpencilvdo`;
  try {
    const upstream = await fetch(url);
    const data = await upstream.json();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── pwmarco stream URL proxy ───────────────────────────────────────────────────
proxyRouter.get("/pwmarco-stream-url", async (req, res) => {
  const query = new URLSearchParams(req.query as any).toString();
  const url = `https://m.pwmarco.site/api/stream-url?${query}`;
  try {
    const upstream = await fetch(url);
    const data = await upstream.json();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Vidcloud stream URL extractor ─────────────────────────────────────────────
// Fetches vidcloud's play.php page (which has PW auth baked in) and extracts
// any CloudFront signed MPD/HLS/M3U8 URLs embedded in the page source.
proxyRouter.get("/vidcloud-stream", async (req, res) => {
  const bId = (req.query.batchId || req.query.batch_id) as string;
  const sId = (req.query.subjectId || req.query.subject_id || "") as string;
  const vId = (req.query.videoId || req.query.childId || req.query.video_id) as string;
  if (!bId || !vId) {
    res.status(400).json({ error: "Missing batchId or videoId" });
    return;
  }

  const vidcloudUrl = `https://vidcloud.eu.org/play.php?batch_id=${encodeURIComponent(bId)}&subject_id=${encodeURIComponent(sId)}&video_id=${encodeURIComponent(vId)}&video_type=new`;

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
      playUrl: vidcloudUrl,
      // Also include the raw page length for debugging
      pageLength: html.length,
    });
  } catch (err) {
    req.log.error({ err }, "vidcloud-stream fetch failed");
    res.status(502).json({ error: "Failed to fetch vidcloud page", playUrl: vidcloudUrl });
  }
});

// ── Vidcloud embedded player proxy ───────────────────────────────────────────
// Proxies vidcloud's play.php page server-side to avoid cross-origin iframe
// 302 redirects to testwave.cc. Serves the full HTML with updated script URLs.
proxyRouter.get("/vidcloud-embed", async (req, res) => {
  const bId = (req.query.batchId || req.query.batch_id) as string;
  const sId = (req.query.subjectId || req.query.subject_id || "") as string;
  const vId = (req.query.videoId || req.query.childId || req.query.video_id) as string;
  if (!bId || !vId) {
    res.status(400).send("Missing batchId or videoId");
    return;
  }

  const vidcloudUrl = `https://vidcloud.eu.org/play.php?batch_id=${encodeURIComponent(bId)}&subject_id=${encodeURIComponent(sId)}&video_id=${encodeURIComponent(vId)}&video_type=new`;

  try {
    const upstream = await fetch(vidcloudUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.pw.live/",
      },
    });

    if (!upstream.ok) {
      res.status(upstream.status).send(`Failed to fetch upstream player: ${upstream.statusText}`);
      return;
    }

    let html = await upstream.text();
    // Point relative scripts to absolute vidcloud URL
    html = html.replace(/src=["']video-script\.js\?v=102["']/g, 'src="https://vidcloud.eu.org/video-script.js?v=102"');
    html = html.replace(/<script[^>]*rocket-loader[^>]*><\/script>/gi, '');

    res.removeHeader("X-Frame-Options");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(html);
  } catch (err) {
    req.log.error({ err }, "vidcloud-embed fetch failed");
    res.status(502).send("Failed to proxy vidcloud player");
  }
});

// ── Aryavidya embedded player proxy ──────────────────────────────────────────
const aryavidyaCookieJar = new Map<string, { cookieHeader: string; token: string; ts: number }>();

function solveAryavidyaDomChallenge(html: string): string {
  try {
    const spanMatches = [...html.matchAll(/<span id=['"]([^'"]+)['"](?: data-([a-z0-9]+)=['"]([^'"]+)['"])?>([^<]*)<\/span>/g)];
    const map: Record<string, { text: string; data?: string }> = {};
    for (const m of spanMatches) {
      map[m[1]] = { text: m[4], data: m[3] };
    }
    const lines = html.match(/_p(?:\[[^\]]*\]\s*=\s*|\.push\s*\()\s*document\.getElementById\(['"]([^'"]+)['"]\)\.(innerHTML|getAttribute\(['"][^'"]+['"]\))/g) || [];
    let token = "";
    for (const line of lines) {
      const id = line.match(/getElementById\(['"]([^'"]+)['"]\)/)?.[1];
      if (id && map[id]) {
        token += line.includes("getAttribute") ? (map[id].data || "") : map[id].text;
      }
    }
    return token;
  } catch {
    return "";
  }
}

proxyRouter.get("/aryavidya-embed", async (req, res) => {
  const bId = (req.query.batchId || req.query.batch_id || "") as string;
  const sId = (req.query.subjectId || req.query.subject_id || req.query.subject_id_original || "") as string;
  const vId = (req.query.videoId || req.query.childId || req.query.video_id || "") as string;
  const title = (req.query.title || "") as string;
  const poster = (req.query.poster || "") as string;
  const topicId = (req.query.topicId || req.query.topic_id || vId) as string;
  const subjectSlug = (req.query.subject_slug || "") as string;
  const topicSlug = (req.query.topic_slug || "") as string;
  const videoKey = (req.query.video_key || vId) as string;
  const urlType = (req.query.urlType || "penpencilvdo") as string;
  const videoType = (req.query.video_type || req.query.videoType || "pw") as string;

  const targetUrl = (req.query.targetUrl || req.query.url) as string ||
    `https://stream.aryavidya.cc/play.php?video_url=&title=${encodeURIComponent(title)}&poster=${encodeURIComponent(poster)}&video_id=${encodeURIComponent(vId)}&batch_id=${encodeURIComponent(bId)}&subject_id=${encodeURIComponent(sId)}&video_type=${encodeURIComponent(videoType)}&subject_id_original=${encodeURIComponent(sId)}&topic_id=${encodeURIComponent(topicId)}&subject_slug=${encodeURIComponent(subjectSlug)}&topic_slug=${encodeURIComponent(topicSlug)}&video_key=${encodeURIComponent(videoKey)}&urlType=${encodeURIComponent(urlType)}`;

  try {
    const upstream1 = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": "https://stream.aryavidya.cc/",
      },
    });

    let html = await upstream1.text();
    let token = "";
    let cookieHeader = "";

    // Check if anti-scraper challenge returned
    if (html.includes("Securing Player...") || html.includes("Verifying secure connection...") || html.includes("pw_chk_")) {
      const setCookie = upstream1.headers.get("set-cookie") || "";
      const phpsessid = setCookie.match(/PHPSESSID=([^;]+)/)?.[1] || "";
      token = solveAryavidyaDomChallenge(html);

      cookieHeader = `PHPSESSID=${phpsessid}; _pw_sec_chk=${token}`;
      if (vId) aryavidyaCookieJar.set(vId, { cookieHeader, token, ts: Date.now() });

      const upstream2 = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Referer": "https://stream.aryavidya.cc/",
          "Cookie": cookieHeader,
        },
      });

      if (upstream2.ok) {
        html = await upstream2.text();
      }
    }

    // Rewrite relative API calls to our backend proxy
    html = html.replace(/(["\x27`])(?:\.\/)?api\//g, "$1/api/aryavidya-proxy/api/");
    html = html.replace(/<script[^>]*rocket-loader[^>]*><\/script>/gi, '');

    // Replace Telegram links with user's Telegram link
    html = html.replace(/https:\/\/t\.me\/\+7ZOFDDkVnTBjM2E1/g, "https://t.me/gouravpwx");
    html = html.replace(/https:\/\/t\.me\/curropted_files/g, "https://t.me/gouravpwx");

    // Inject document.cookie and guarantee getCookie('_pw_sec_chk') returns the token
    if (token) {
      html = html.replace("getCookie('_pw_sec_chk')", `(getCookie('_pw_sec_chk') || '${token}')`);
      const cookieInject = `<script>try{document.cookie = "_pw_sec_chk=${token}; path=/; max-age=86400;"; window._pw_sec_token = "${token}";}catch(e){}</script>`;
      html = html.replace("<head>", `<head>${cookieInject}`);
    }

    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (token) {
      res.setHeader("Set-Cookie", `_pw_sec_chk=${token}; Path=/; SameSite=Lax`);
    }
    res.send(html);
  } catch (err) {
    req.log.error({ err }, "aryavidya-embed fetch failed");
    res.status(502).send("Failed to proxy aryavidya player");
  }
});

proxyRouter.all("/aryavidya-proxy/*path", async (req, res) => {
  const rawPath = (req.params as any).path;
  const subPath = Array.isArray(rawPath)
    ? rawPath.join("/")
    : typeof rawPath === "string"
      ? rawPath
      : req.url.replace(/^\/aryavidya-proxy\/?/, "");
  const qIdx = req.url.indexOf("?");
  const queryString = qIdx >= 0 ? req.url.slice(qIdx) : "";
  const fullSubPath = subPath + (subPath.includes("?") ? "" : queryString);
  const targetUrl = `https://stream.aryavidya.cc/${fullSubPath}`;

  try {
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Referer": "https://stream.aryavidya.cc/play.php",
      "Origin": "https://stream.aryavidya.cc",
    };

    if (req.headers["content-type"]) {
      headers["Content-Type"] = req.headers["content-type"] as string;
    }

    let cookie = (req.headers["cookie"] as string) || "";
    if (!cookie.includes("_pw_sec_chk")) {
      const last = Array.from(aryavidyaCookieJar.values()).pop();
      if (last?.cookieHeader) cookie = last.cookieHeader;
    }
    if (cookie) headers["Cookie"] = cookie;

    const body = ["POST", "PUT", "PATCH"].includes(req.method)
      ? (typeof req.body === "string" ? req.body : JSON.stringify(req.body))
      : undefined;

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    res.status(upstream.status);
    upstream.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (lower !== "content-encoding" && lower !== "transfer-encoding") {
        res.setHeader(key, val);
      }
    });
    res.setHeader("Access-Control-Allow-Origin", "*");
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    req.log.error({ err, targetUrl }, "aryavidya-proxy forward failed");
    res.status(502).json({ error: "Failed to forward request to aryavidya" });
  }
});

// ── Stream Decryption Resolver ───────────────────────────────────────────────
// Resolves private PW CloudFront signed streams and DRM clearKeys
proxyRouter.options("/resolve-stream", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.status(204).end();
});

proxyRouter.get("/resolve-stream", async (req, res) => {
  const bId = (req.query.batchId || req.query.batch_id) as string;
  const sId = (req.query.subjectId || req.query.subject_id || "") as string;
  const vId = (req.query.videoId || req.query.childId || req.query.video_id) as string;

  if (!bId || !vId) {
    res.status(400).json({ success: false, error: "Missing batchId or videoId" });
    return;
  }

  try {
    const result = await resolveStreamWithVidcloud(bId, sId, vId);
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (result && result.streamUrl) {
      res.json({
        success: true,
        streamUrl: result.streamUrl,
        clearKeys: result.clearKeys || null,
      });
    } else {
      res.status(404).json({
        success: false,
        error: "Unable to resolve stream decryption keys",
      });
    }
  } catch (err) {
    req.log.error({ err }, "resolve-stream failed");
    res.status(500).json({ success: false, error: "Stream resolver failed" });
  }
});

// ── learnbyakp video-url proxy ───────────────────────────────────────────────
// Forwards to https://learnbyakp.onrender.com/api/video-url and returns the
// full JSON (url, directUrl, streamUrl, signedUrl, clearKeys, vid, topic).
proxyRouter.options("/akp-video-url", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.status(204).end();
});

proxyRouter.get("/akp-video-url", async (req, res) => {
  const bId = (req.query.batchId || req.query.batch_id) as string;
  const cId = (req.query.childId || req.query.child_id || req.query.videoId || req.query.video_id) as string;
  if (!bId || !cId) {
    res.status(400).json({ error: "Missing batchId or childId" });
    return;
  }

  const upstream = `https://learnbyakp.onrender.com/api/video-url?batchId=${encodeURIComponent(bId)}&childId=${encodeURIComponent(cId)}`;

  try {
    const resp = await fetch(upstream, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, */*",
        "Referer": "https://learnbyakp.online/",
        "Origin": "https://learnbyakp.online",
      },
    });

    const data = await resp.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(resp.status).json(data);
  } catch (err) {
    req.log.error({ err }, "akp-video-url proxy fetch failed");
    res.status(502).json({ error: "Upstream fetch failed" });
  }
});

// ── PW lecture slides + attachments ─────────────────────────────────────────
// Keeps the browser independent of the upstream API's CORS and normalizes the
// two schedule endpoints into the small shape the video player needs.
const OBJECT_ID = /^[a-f\d]{24}$/i;

function pwAssetUrl(asset: any, fallback?: string): string {
  if (asset?.baseUrl && asset?.key) return `${asset.baseUrl}${asset.key}`;
  if (asset?.url && /^https?:\/\//i.test(asset.url)) return asset.url;
  if (fallback && /^https?:\/\//i.test(fallback)) return fallback;
  if (fallback) return `https://static.pw.live/${fallback.replace(/^\/+/, "")}`;
  return "";
}

function normalizeSlide(slide: any) {
  const timestamp = Number.parseFloat(String(slide?.timeStamp ?? slide?.timestamp ?? ""));
  const imageUrl = pwAssetUrl(slide?.img, slide?.imageUrl);
  if (!Number.isFinite(timestamp) || !imageUrl) return null;
  return {
    id: String(slide?._id ?? `${slide?.serialNumber ?? "slide"}-${timestamp}`),
    name: String(slide?.name ?? `Slide ${slide?.serialNumber ?? ""}`).trim(),
    serialNumber: Number(slide?.serialNumber ?? 0),
    timestamp,
    imageUrl,
  };
}

function normalizeAttachments(schedule: any) {
  const homework = [
    ...(Array.isArray(schedule?.homeworkIds) ? schedule.homeworkIds : []),
    ...(Array.isArray(schedule?.dpp?.homeworkIds) ? schedule.dpp.homeworkIds : []),
  ];
  const seen = new Set<string>();
  const attachments: Array<{ id: string; title: string; name: string; url: string }> = [];

  for (const item of homework) {
    // Some responses only contain homework ids. There is no usable file URL
    // in that form, so skip those entries rather than rendering dead links.
    if (!item || typeof item !== "object") continue;
    for (const attachment of Array.isArray(item.attachmentIds) ? item.attachmentIds : []) {
      const url = pwAssetUrl(attachment);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      attachments.push({
        id: String(attachment?._id ?? url),
        title: String(item.topic ?? item.note ?? attachment?.name ?? "Attachment").trim(),
        name: String(attachment?.name ?? item.note ?? "Open attachment").trim(),
        url,
      });
    }
  }
  return attachments;
}

proxyRouter.options("/pw-schedule-assets", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.status(204).end();
});

proxyRouter.get("/pw-schedule-assets", async (req, res) => {
  const { batchId, subjectId, scheduleId } = req.query as Record<string, string>;
  if (!OBJECT_ID.test(batchId ?? "") || !OBJECT_ID.test(subjectId ?? "") || !OBJECT_ID.test(scheduleId ?? "")) {
    res.status(400).json({ success: false, error: "Invalid batch, subject, or schedule id" });
    return;
  }

  const apiBase = `${await getPwApiUrl()}/v1`;
  const base = `${apiBase}/batches/${batchId}/subject/${subjectId}/schedule/${scheduleId}`;
  try {
    const [slidesResponse, detailsResponse] = await Promise.all([
      fetch(`${base}/slides`, { headers: { Accept: "application/json" } }),
      fetch(`${base}/schedule-details`, { headers: { Accept: "application/json" } }),
    ]);
    if (!slidesResponse.ok || !detailsResponse.ok) {
      res.status(502).json({ success: false, error: "Lecture resources are unavailable" });
      return;
    }

    const [slidesJson, detailsJson] = await Promise.all([
      slidesResponse.json() as Promise<any>,
      detailsResponse.json() as Promise<any>,
    ]);
    const slideSource = slidesJson?.data?.slides ?? slidesJson?.slides ?? [];
    const slides = (Array.isArray(slideSource) ? slideSource : [])
      .filter((slide: any) => slide?.slideForTimeline !== false)
      .map(normalizeSlide)
      .filter(Boolean)
      .sort((a: any, b: any) => a.timestamp - b.timestamp);
    const schedule = detailsJson?.data ?? detailsJson;

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({
      success: true,
      data: {
        slides,
        attachments: normalizeAttachments(schedule),
        topic: schedule?.topic ?? "",
      },
    });
  } catch (err) {
    req.log.error({ err }, "PW schedule assets proxy failed");
    res.status(502).json({ success: false, error: "Failed to load lecture resources" });
  }
});

// ── Direct video download proxy ──────────────────────────────────────────────
// Manifest/DRM URLs are intentionally not accepted here. The player only calls
// this route when the upstream API exposes a real media file URL.
proxyRouter.get("/video-download", async (req, res) => {
  const rawUrl = req.query.url as string | undefined;
  const requestedName = req.query.filename as string | undefined;
  if (!rawUrl) {
    res.status(400).json({ error: "Missing video URL" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    res.status(400).json({ error: "Invalid video URL" });
    return;
  }

  if (!isAllowedCdnHost(parsed.hostname) || !/\.(mp4|webm|mov|m4v|mkv)$/i.test(parsed.pathname)) {
    res.status(403).json({ error: "Only direct media files can be downloaded" });
    return;
  }

  try {
    let upstream: Response | null = null;
    for (const headers of CDN_HEADER_VARIANTS) {
      const response = await fetch(parsed, { headers });
      if (response.status !== 403) {
        upstream = response;
        break;
      }
    }
    if (!upstream || !upstream.ok || !upstream.body) {
      res.status(upstream?.status || 502).json({ error: "Video download failed" });
      return;
    }

    const safeName = (requestedName || "pwx-video.mp4")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 120);
    res.status(200);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    Readable.fromWeb(upstream.body as any).pipe(res);
  } catch (err) {
    req.log.error({ err }, "video download proxy failed");
    if (!res.headersSent) res.status(502).json({ error: "Video download failed" });
  }
});

// ── PW video metadata proxy (fetches from pwsecure with proper headers) ────────
proxyRouter.get("/pw-video/:videoId", async (req, res) => {
  const { videoId } = req.params as { videoId: string };
  if (!videoId) {
    res.status(400).json({ error: "Missing videoId" });
    return;
  }

  const PW_SECURE = await getPwApiUrl();
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

proxyRouter.options(["/proxy", "/pdf", "/proxy-pdf", "/GetPdf", "/get-pdf", "/getPdf", "/dash-seg/*path"], (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.status(204).end();
});

proxyRouter.get("/resolver-status", async (_req, res) => {
  try {
    const diag = await getResolverDiagnostics();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(diag);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

/**
 * Lazy on-demand PDF key resolution endpoint
 * GET /api/GetPdf?BatchId=...&SubjectId=...&PdfId=...&HomeworkId=...
 */
proxyRouter.get(["/GetPdf", "/get-pdf", "/getPdf"], async (req, res) => {
  const batchId = (req.query.BatchId || req.query.batchId) as string | undefined;
  const subjectId = (req.query.SubjectId || req.query.subjectId) as string | undefined;
  const pdfId = (req.query.PdfId || req.query.pdfId) as string | undefined;
  const homeworkId = (req.query.HomeworkId || req.query.homeworkId) as string | undefined;

  if (!pdfId && !homeworkId) {
    res.status(400).json({ error: "Missing PdfId or HomeworkId" });
    return;
  }

  try {
    const resolved = await resolvePdfKey(batchId || "", subjectId || "", pdfId || "", homeworkId || "");
    if (!resolved || !resolved.key) {
      res.status(404).json({ error: "Unable to resolve PDF storage key" });
      return;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.json({
      status: 200,
      success: true,
      data: resolved,
    });
  } catch (err: any) {
    req.log.error({ err }, "GetPdf resolution error");
    res.status(500).json({ error: "Failed to resolve PDF key", details: err?.message });
  }
});

proxyRouter.get(["/pdf", "/proxy-pdf"], async (req, res) => {
  const rawUrl = (req.query.url || req.query.Url) as string | undefined;
  const filename = (req.query.filename || req.query.name) as string | undefined;
  const download = req.query.download === "1" || req.query.download === "true";

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

    const safeFilename = (filename || "Document.pdf").replace(/[^a-zA-Z0-9_.\- ]/g, "_");

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "public, max-age=3600");
    if (download) {
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(safeFilename)}"`);
    } else {
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(safeFilename)}"`);
    }

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    res.status(upstream.status);

    const buf = await upstream.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch (err) {
    req.log.error({ err }, "pdf proxy fetch failed");
    res.status(502).json({ error: "Upstream fetch failed" });
  }
});

proxyRouter.get("/proxy", async (req, res) => {
  let rawUrl = req.query.url as string | undefined;
  if (!rawUrl) {
    res.status(400).json({ error: "Missing url" });
    return;
  }

  // Safeguard: If query parameters like Signature, Key-Pair-Id, Policy were split by Express query parser
  const extraParams = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key !== "url" && typeof value === "string") {
      if (!rawUrl.includes(key + "=")) {
        extraParams.set(key, value);
      }
    }
  }
  const extraStr = extraParams.toString();
  if (extraStr) {
    rawUrl += (rawUrl.includes("?") ? "&" : "?") + extraStr;
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

  const isMpd =
    rawUrl.includes(".mpd") ||
    rawUrl.includes(".m3u8") ||
    rawUrl.includes(".xml");

  if (isMpd) {
    try {
      const { status, contentType, buffer } = await fetchCdn(rawUrl);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.status(status);

      if (status < 300) {
        const mpdText = new TextDecoder().decode(buffer);
        res.setHeader("Content-Type", "application/dash+xml");
        
        // Extract the absolute base path from the original URL (e.g., https://host/path/to/)
        const basePath = rawUrl.substring(0, rawUrl.lastIndexOf("/") + 1);
        
        // Inject the absolute original BaseURL into the MPD.
        const rewritten = injectBaseUrl(mpdText, basePath);
        res.end(rewritten);
      } else {
        res.setHeader("Content-Type", contentType);
        res.end(Buffer.from(buffer));
      }
    } catch (err) {
      req.log.error({ err }, "proxy MPD fetch failed");
      res.status(502).json({ error: "Upstream fetch failed" });
    }
  } else {
    // For large video segments (.m4s, .mp4, .ts), stream directly instead of buffering in memory
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
    
    try {
      const variants = rawUrl.includes("cloudfront.net")
        ? [CDN_HEADER_VARIANTS[2], CDN_HEADER_VARIANTS[0], CDN_HEADER_VARIANTS[1], CDN_HEADER_VARIANTS[3]]
        : CDN_HEADER_VARIANTS;

      let upstream: Response | null = null;
      for (const baseHeaders of variants) {
        const headers: Record<string, string> = { ...baseHeaders };
        if (req.headers.range) {
          headers["Range"] = req.headers.range;
        }
        upstream = await fetch(rawUrl, { headers });
        if (upstream.status !== 403) break;
      }
      if (!upstream) {
        const headers: Record<string, string> = {};
        if (req.headers.range) headers["Range"] = req.headers.range;
        upstream = await fetch(rawUrl, { headers });
      }
      
      res.status(upstream.status);
      res.setHeader("Content-Type", upstream.headers.get("content-type") || "video/mp4");
      const cr = upstream.headers.get("content-range");
      if (cr) res.setHeader("Content-Range", cr);
      const ar = upstream.headers.get("accept-ranges");
      if (ar) res.setHeader("Accept-Ranges", ar);
      const cl = upstream.headers.get("content-length");
      if (cl) res.setHeader("Content-Length", cl);
      
      if (upstream.body) {
        Readable.fromWeb(upstream.body as any).pipe(res);
      } else {
        res.end();
      }
    } catch (err) {
      req.log.error({ err }, "proxy segment fetch failed");
      res.status(502).end();
    }
  }
});

proxyRouter.get("/dash-seg/:sig/{*path}", async (req, res) => {
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

  // Stream segments directly — avoids buffering entire segment on server before sending
  for (const headers of CDN_HEADER_VARIANTS) {
    try {
      const upstream = await fetch(cdnUrl, { headers });
      if (upstream.status === 403) continue;

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
      res.setHeader("Cache-Control", "public, max-age=3600, immutable");
      const cl = upstream.headers.get("content-length");
      if (cl) res.setHeader("Content-Length", cl);
      res.status(upstream.status);

      if (upstream.body) {
        Readable.fromWeb(upstream.body as any).pipe(res);
      } else {
        res.end();
      }
      return;
    } catch (err) {
      req.log.error({ err }, "dash-seg stream attempt failed");
    }
  }

  res.status(502).json({ error: "Segment fetch failed" });
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

// ── Streama HLS proxy (bypasses CORS/IP blocks on streama.pimaxer.in) ──────
// Cloudflare Pages IPs are blocked by streama, so we route through Render.
const STREAMA_HOST = "streama.pimaxer.in";

proxyRouter.options("/streama-proxy", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.status(204).end();
});

proxyRouter.get("/streama-proxy", async (req, res) => {
  const rawUrl = req.query.url as string | undefined;
  if (!rawUrl) {
    res.status(400).json({ error: "Missing url param" });
    return;
  }

  let fullUrl = rawUrl;
  if (!fullUrl.startsWith("http")) fullUrl = `https://${STREAMA_HOST}/${fullUrl.replace(/^\//, "")}`;

  let parsed: URL;
  try {
    parsed = new URL(fullUrl);
  } catch (e) {
    req.log.error({ rawUrl, err: e }, "streama-proxy: invalid URL");
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  if (parsed.hostname !== STREAMA_HOST) {
    res.status(403).json({ error: "Only streama.pimaxer.in is allowed" });
    return;
  }

  try {
    req.log.info({ url: fullUrl }, "streama-proxy: fetching");
    const upstream = await fetch(fullUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Origin": "http://localhost:5000",
        "Referer": "http://localhost:5000/",
        "Accept": "*/*",
      },
    });

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const isM3u8 = fullUrl.endsWith(".m3u8") || contentType.toLowerCase().includes("mpegurl");

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    // Do not cache .m3u8 files on the proxy to prevent stale rewrites, but cache segments
    if (!isM3u8) {
      res.setHeader("Cache-Control", "public, max-age=3600");
    } else {
      res.setHeader("Cache-Control", "no-cache");
    }

    res.status(upstream.status);
    res.setHeader("Content-Type", contentType);

    if (isM3u8) {
      let buf = Buffer.from(await upstream.arrayBuffer());
      const text = buf.toString("utf-8");
      const rewritten = text.split("\n").map(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("http")) {
          try {
            return new URL(trimmed, fullUrl).href;
          } catch {
            return line;
          }
        }
        return line;
      }).join("\n");
      buf = Buffer.from(rewritten, "utf-8");
      res.setHeader("Content-Length", buf.length);
      res.end(buf);
    } else {
      const cl = upstream.headers.get("content-length");
      if (cl) res.setHeader("Content-Length", cl);

      if (upstream.body) {
        const reader = upstream.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        const buf = Buffer.from(await upstream.arrayBuffer());
        res.end(buf);
      }
    }
  } catch (err) {
    req.log.error({ err, url: fullUrl }, "streama-proxy fetch failed");
    if (!res.headersSent) res.status(502).json({ error: "Upstream fetch failed" });
  }
});


export default proxyRouter;
