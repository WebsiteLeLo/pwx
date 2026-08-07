/**
 * SSR meta-injection middleware for production.
 *
 * In production, Express serves the built Vite output (dist/public/).
 * Before returning index.html for any SPA route, this middleware injects
 * route-specific <title>, <meta>, <link rel="canonical">, and JSON-LD so
 * Googlebot (which doesn't reliably execute JS) sees proper per-page metadata.
 *
 * Route → meta mapping lives in ROUTE_META below.
 */

import { readFileSync } from "fs";
import path from "path";
import type { Request, Response } from "express";

const SITE_URL = process.env.FRONTEND_URL ?? "https://pwx.pages.dev";
const SITE_NAME = "PWX — PW Free Batches";
const DEFAULT_IMAGE = "https://cdn.pw.live/subjects/pwicons/PW.png";
const TITLE_SUFFIX = "PWX";

// ── meta per static route ────────────────────────────────────────────────────

interface PageMeta {
  title: string;
  description: string;
  ogImage?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema?: Record<string, any>;
}

const STATIC_ROUTES: Record<string, PageMeta> = {
  "/": {
    title: `${SITE_NAME} | IIT JEE & NEET Free Video Lectures`,
    description:
      "Browse 12,000+ Physics Wallah free batches for IIT JEE, NEET & Foundation. Watch free video lectures, DPP quizzes and study materials — no subscription required.",
    schema: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
      description:
        "Access all Physics Wallah free batches for IIT JEE and NEET preparation.",
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  },
  "/schedule": {
    title: `Today's PW Live Class Schedule | ${TITLE_SUFFIX}`,
    description:
      "View today's Physics Wallah live class schedule. Check PW batch lecture timings for IIT JEE and NEET — updated in real time on PWX.",
    schema: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `Today's PW Live Class Schedule | ${TITLE_SUFFIX}`,
      url: `${SITE_URL}/schedule`,
      description:
        "Today's Physics Wallah class schedule with live lecture timings.",
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: "Schedule",
            item: `${SITE_URL}/schedule`,
          },
        ],
      },
    },
  },
  "/my-mix": {
    title: `My Study Mix | Custom PW Batch | ${TITLE_SUFFIX}`,
    description:
      "Create your personalised study mix from Physics Wallah batches. Combine Physics from one batch, Maths from another — study your way on PWX.",
    schema: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `My Study Mix | ${TITLE_SUFFIX}`,
      url: `${SITE_URL}/my-mix`,
      description: "Custom study mix from Physics Wallah batches.",
    },
  },
  "/materials": {
    title: `PW Study Materials | Notes & DPP Sheets | ${TITLE_SUFFIX}`,
    description:
      "Download Physics Wallah study materials, DPP sheets, and notes for IIT JEE and NEET preparation — all free on PWX.",
  },
};

// ── dynamic route meta generators ───────────────────────────────────────────

function batchMeta(batchId: string): PageMeta {
  return {
    title: `PW Free Batch | Physics Wallah | ${TITLE_SUFFIX}`,
    description: `Watch this Physics Wallah free batch on PWX. Free video lectures, DPP quizzes, and study materials for IIT JEE & NEET preparation.`,
    schema: {
      "@context": "https://schema.org",
      "@type": "Course",
      name: "Physics Wallah Free Batch",
      description:
        "Free video lectures, DPP quizzes, and study materials by Physics Wallah.",
      url: `${SITE_URL}/batch/${batchId}`,
      image: DEFAULT_IMAGE,
      provider: {
        "@type": "Organization",
        name: "Physics Wallah (PW)",
        sameAs: "https://www.pw.live",
      },
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
    },
  };
}

function subjectMeta(batchId: string, subjectId: string): PageMeta {
  return {
    title: `PW Subject Lectures | ${TITLE_SUFFIX}`,
    description: `Browse video lectures and study material for this Physics Wallah subject on PWX. Free chapters, notes and DPP for IIT JEE & NEET.`,
    schema: {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Physics Wallah Subject Chapters",
      url: `${SITE_URL}/batch/${batchId}/subject/${subjectId}`,
      description: "Free Physics Wallah subject lectures and chapters on PWX.",
    },
  };
}

function topicMeta(
  batchId: string,
  subjectId: string,
  topicId: string,
): PageMeta {
  return {
    title: `PW Chapter Videos, Notes & DPP | ${TITLE_SUFFIX}`,
    description: `Watch free Physics Wallah video lectures for this chapter. Download notes and DPP sheets for IIT JEE & NEET preparation on PWX.`,
    schema: {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Physics Wallah Chapter Content",
      url: `${SITE_URL}/batch/${batchId}/subject/${subjectId}/topic/${topicId}`,
      description:
        "Free Physics Wallah chapter video lectures, notes, and DPP sheets.",
    },
  };
}

// ── route resolver ───────────────────────────────────────────────────────────

function resolveRouteMeta(pathname: string): PageMeta | null {
  // Static routes — exact match
  if (STATIC_ROUTES[pathname]) return STATIC_ROUTES[pathname];

  // Dynamic: /batch/:batchId
  const batchMatch = pathname.match(/^\/batch\/([^/]+)$/);
  if (batchMatch) return batchMeta(batchMatch[1]);

  // Dynamic: /batch/:batchId/subject/:subjectId
  const subjectMatch = pathname.match(/^\/batch\/([^/]+)\/subject\/([^/]+)$/);
  if (subjectMatch) return subjectMeta(subjectMatch[1], subjectMatch[2]);

  // Dynamic: /batch/:batchId/subject/:subjectId/topic/:topicId
  const topicMatch = pathname.match(
    /^\/batch\/([^/]+)\/subject\/([^/]+)\/topic\/([^/]+)$/,
  );
  if (topicMatch)
    return topicMeta(topicMatch[1], topicMatch[2], topicMatch[3]);

  return null;
}

// ── HTML injection ───────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function injectMeta(html: string, pathname: string, meta: PageMeta): string {
  const title = meta.title;
  const description = escapeHtml(meta.description);
  const image = meta.ogImage || DEFAULT_IMAGE;
  const canonical = `${SITE_URL}${pathname}`;

  // Replace <title>
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);

  // Replace existing meta description
  html = html.replace(
    /(<meta\s+name="description"\s+content=")[^"]*(")/,
    `$1${description}$2`,
  );

  // Replace OG tags
  html = html.replace(
    /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
    `$1${escapeHtml(title)}$2`,
  );
  html = html.replace(
    /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
    `$1${description}$2`,
  );
  html = html.replace(
    /(<meta\s+property="og:url"\s+content=")[^"]*(")/,
    `$1${escapeHtml(canonical)}$2`,
  );
  html = html.replace(
    /(<meta\s+property="og:image"\s+content=")[^"]*(")/,
    `$1${escapeHtml(image)}$2`,
  );

  // Replace Twitter tags
  html = html.replace(
    /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,
    `$1${escapeHtml(title)}$2`,
  );
  html = html.replace(
    /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
    `$1${description}$2`,
  );

  // Replace canonical link
  html = html.replace(
    /(<link\s+rel="canonical"\s+href=")[^"]*(")/,
    `$1${escapeHtml(canonical)}$2`,
  );

  // Inject page-specific JSON-LD before </head>
  if (meta.schema) {
    const schemaTag = `<script type="application/ld+json" id="__ssr-page-schema__">${JSON.stringify(meta.schema)}</script>`;
    html = html.replace("</head>", `${schemaTag}\n</head>`);
  }

  return html;
}

// ── middleware factory ───────────────────────────────────────────────────────

let cachedHtml: string | null = null;

export function createSsrMiddleware(distPublicPath: string) {
  return function ssrMiddleware(req: Request, res: Response) {
    try {
      // Read index.html once per process start, then cache it
      if (!cachedHtml) {
        const htmlPath = path.join(distPublicPath, "index.html");
        cachedHtml = readFileSync(htmlPath, "utf-8");
      }

      const pathname = req.path;
      const meta = resolveRouteMeta(pathname);
      const html = meta ? injectMeta(cachedHtml, pathname, meta) : cachedHtml;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader(
        "Cache-Control",
        meta ? "public, max-age=300, stale-while-revalidate=3600" : "no-cache",
      );
      res.send(html);
    } catch (err) {
      // Fallback: let Vite/CDN serve the file
      res.status(500).send("Internal Server Error");
    }
  };
}

export function getSitemapXml(): string {
  const today = new Date().toISOString().split("T")[0];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">

  <!-- Core pages -->
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>

  <url>
    <loc>${SITE_URL}/schedule</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>

  <url>
    <loc>${SITE_URL}/my-mix</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>

  <url>
    <loc>${SITE_URL}/materials</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>

</urlset>`;
}
