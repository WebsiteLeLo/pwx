/**
 * usePageMeta — dynamic per-page SEO metadata management.
 *
 * Updates document.title, all meta tags, canonical link, and JSON-LD schema
 * on every route change. Runs entirely in the browser so social-sharing
 * previews (WhatsApp, Telegram, Twitter) and modern crawlers that execute JS
 * all get accurate, page-specific metadata.
 *
 * For Googlebot SSR coverage, see artifacts/api-server/src/lib/seo.ts.
 */

import { useEffect } from "react";

const BASE_SITE = "https://pwx.onrender.com";
const DEFAULT_OG_IMAGE = "https://cdn.pw.live/subjects/pwicons/PW.png";
const SITE_SUFFIX = "PWX";

export interface PageMetaOptions {
  title: string;
  description: string;
  /** Absolute path, e.g. "/batch/abc123". Defaults to current pathname. */
  canonical?: string;
  ogImage?: string;
  /** JSON-LD schema object or array of objects. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema?: Record<string, any> | Record<string, any>[];
}

// ── helpers ──────────────────────────────────────────────────────────────────

function upsertMeta(selector: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    // Parse the selector to set the right attribute pair
    const match = selector.match(/\[([^=]+)="([^"]+)"\]/);
    if (match) el.setAttribute(match[1], match[2]);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

function upsertSchema(schema: PageMetaOptions["schema"]) {
  let el = document.getElementById("__page-schema__") as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = "__page-schema__";
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(
    Array.isArray(schema) ? schema : schema,
    null,
    0,
  );
}

function removeSchema() {
  document.getElementById("__page-schema__")?.remove();
}

// ── hook ─────────────────────────────────────────────────────────────────────

export function usePageMeta({
  title,
  description,
  canonical,
  ogImage,
  schema,
}: PageMetaOptions) {
  useEffect(() => {
    const fullTitle = `${title} | ${SITE_SUFFIX}`;
    const image = ogImage || DEFAULT_OG_IMAGE;
    const path = canonical ?? window.location.pathname;
    const url = path.startsWith("http") ? path : `${BASE_SITE}${path}`;

    const prevTitle = document.title;
    document.title = fullTitle;

    // Primary SEO
    upsertMeta('meta[name="description"]', description);

    // Open Graph
    upsertMeta('meta[property="og:title"]', fullTitle);
    upsertMeta('meta[property="og:description"]', description);
    upsertMeta('meta[property="og:url"]', url);
    upsertMeta('meta[property="og:image"]', image);

    // Twitter Card
    upsertMeta('meta[name="twitter:title"]', fullTitle);
    upsertMeta('meta[name="twitter:description"]', description);
    upsertMeta('meta[name="twitter:image"]', image);

    // Canonical
    upsertCanonical(url);

    // JSON-LD
    if (schema) {
      upsertSchema(schema);
    } else {
      removeSchema();
    }

    return () => {
      document.title = prevTitle;
      // Don't restore other meta on unmount — the next page's hook overwrites them
      // and restoring causes a brief flash of stale data.
    };
  }, [title, description, canonical, ogImage, JSON.stringify(schema)]);
}

// ── helpers for pages to build schema objects ────────────────────────────────

export function breadcrumbSchema(
  items: Array<{ label: string; href?: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${BASE_SITE}${item.href}` } : {}),
    })),
  };
}

export function courseSchema({
  name,
  description,
  url,
  image,
  provider = "Physics Wallah (PW)",
}: {
  name: string;
  description: string;
  url: string;
  image?: string;
  provider?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name,
    description,
    url: `${BASE_SITE}${url}`,
    image: image || DEFAULT_OG_IMAGE,
    provider: {
      "@type": "Organization",
      name: provider,
      sameAs: "https://www.pw.live",
    },
    isAccessibleForFree: true,
    educationalLevel: "HighSchool",
    inLanguage: "hi",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
    },
  };
}
