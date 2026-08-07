---
name: Sitemap domain alignment
description: Keep crawler files and SEO metadata aligned with the actual published host.
---

The sitemap, robots.txt Sitemap directive, canonical URLs, Open Graph URLs, SSR site URL, and shared deployment `FRONTEND_URL` must all use the same live domain. A valid XML sitemap can still be reported incorrectly when runtime SEO advertises an old host or the current build has not been published. For Cloudflare Pages domains, changes must reach the connected GitHub branch; Replit publishing alone does not update that site.

**Why:** Search Console was pointed at the pages.dev property while runtime/shared configuration still advertised the old onrender.com host; the live XML itself was valid and returned 200 application/xml, but mixed canonical hosts can make crawler diagnostics inconsistent.

**How to apply:** When changing the public host, update static crawler files and runtime SEO defaults together, preserve sitemap/robots files ahead of SPA fallbacks, push the connected GitHub branch, confirm the live response, then resubmit `/sitemap.xml` in the matching Search Console property. Advertise only URLs that actually return the sitemap format; SPA fallbacks must not be referenced as text sitemaps.