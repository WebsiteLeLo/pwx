# PWX — PhysicsWallah Clone

A PWA clone of the PhysicsWallah (PW) educational platform. Lets users browse batches, watch DRM-protected videos, access study materials, manage schedules, and take quizzes.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS v4, Wouter, TanStack Query |
| Backend | Express 5, TypeScript, pnpm workspace |
| DB ORM | Drizzle ORM (PostgreSQL — `DATABASE_URL` required for migrations) |
| Video | Shaka Player (DRM / DASH), HLS.js |
| UI | shadcn/ui (Radix primitives) |

## Monorepo layout

```
artifacts/
  pw-clone/       — React/Vite PWA frontend (port 20318)
  api-server/     — Express API server (port 8080)
  mockup-sandbox/ — Replit UI mockup tool
  og-worker/      — Cloudflare Worker for OG image generation
lib/
  db/             — Drizzle ORM schema & config (needs DATABASE_URL)
  api-client-react/ — React hooks for API
  api-spec/       — OpenAPI / Zod schemas shared between FE and BE
  api-zod/
```

## How to run

Dependencies are managed with **pnpm** at the workspace root.

```bash
pnpm install          # install all workspace dependencies
```

Two workflows run the app:

| Workflow | Command | Port |
|---|---|---|
| `artifacts/pw-clone: web` | `pnpm --filter @workspace/pw-clone run dev` | 20318 |
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` | 8080 |

The Vite dev server proxies `/api` → `http://localhost:8080`.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Auto-injected by Replit | PostgreSQL connection string (runtime-managed) |
| `GOOGLE_AI_API_KEY` | Optional | Enables AI companion (Aria) features |
| `DRIVE_API_KEY` | Optional | Google Drive API key for proxy routes |
| `ADMIN_KEY` | Optional | Admin panel secret (defaults to `admin-secret-2024`) |

## Setup notes

- Run `pnpm install` at workspace root to install all dependencies
- Run `pnpm --filter @workspace/db exec drizzle-kit push` to push DB schema
- The Vite dev server proxies `/api` → `http://localhost:8080`
- Build scripts for `msedge-tts`, `onnxruntime-node`, `protobufjs`, `sharp`, `workerd` must be approved via `pnpm approve-builds` after fresh installs

## User preferences

_None recorded yet._
