# PW Clone (Physics Wallah Clone)

A full-featured clone of the Physics Wallah (PW) learning platform, providing access to JEE/NEET preparation batches, video lectures, study materials, and DRM-protected content playback.

## Run & Operate

- `pnpm --filter @workspace/pw-clone run dev` — run the frontend (Vite dev server)
- `pnpm --filter @workspace/api-server run dev` — run the API server (proxy routes)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, TailwindCSS v4, wouter (routing), framer-motion, TanStack Query
- API: Express 5 (proxy routes for PW CDN, PDF, DASH segments, Google Drive)
- Video: hls.js + shaka-player (DRM-protected DASH + HLS playback)
- UI: shadcn/ui components, Radix UI, lucide-react

## Where things live

- `artifacts/pw-clone/src/` — frontend React app
  - `pages/` — route components (home, batch, subject, topic, watch, schedule-watch, materials)
  - `components/` — shared UI (DrmPlayer, layout, lazy-image, loading-bar, ui/)
  - `hooks/` — data hooks (usePWApi, useEnrolledBatches, useDevToolsDetection)
  - `lib/apiUrl.ts` — API base URL helper (reads VITE_API_URL)
- `artifacts/api-server/src/routes/proxy.ts` — CDN/PDF/DASH/Drive proxy routes
- `lib/api-spec/openapi.yaml` — OpenAPI spec (health endpoint only)

## Architecture decisions

- App fetches PW API data directly from `pwsecure.gourav23032009.workers.dev` and `learnbyakp.onrender.com` — no local DB needed
- CDN proxy routes in Express bypass CORS restrictions for media/PDFs
- DASH MPD rewrites inject BaseURL to route segment requests through local proxy
- Dark mode forced as default (Netflix-style dark UI with electric cyan accent)
- DevTools detection sends `pwx-devtools-open` custom events to block UI

## Product

- Browse all PW batches (JEE, NEET, foundation) with search/filter
- Enroll and access enrolled batches with subjects and topics
- Watch DRM-protected video lectures with custom player (bookmarks, speed control)
- Schedule-based watching and study material downloads

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `VITE_API_URL` must point to the API server's `/api` path for proxy routes to work
- The proxy handles CDN auth headers — never call PW CDN directly from frontend

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
