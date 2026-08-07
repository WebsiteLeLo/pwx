---
name: Sitemap domain alignment
description: Keep crawler files and SEO metadata aligned with the actual published host.
---

The sitemap, robots.txt Sitemap directive, canonical URLs, Open Graph URLs, and SSR site URL must all use the same live domain. A valid XML sitemap can still be reported incorrectly when robots.txt advertises an old host or the current build has not been published.

**Why:** Search Console was pointed at the pages.dev property while robots.txt still advertised the old onrender.com sitemap; the live XML itself was valid and returned 200 application/xml.

**How to apply:** When changing the public host, update static crawler files and runtime SEO defaults together, preserve sitemap/robots files ahead of SPA fallbacks, publish the build, then resubmit `/sitemap.xml` in the matching Search Console property.