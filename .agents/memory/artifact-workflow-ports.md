---
name: Artifact workflow ports
description: How Replit assigns and expects ports for the pw-clone artifact workflows.
---

Replit manages the `artifacts/pw-clone: web` and `artifacts/api-server: API Server` workflows as locked artifacts — their commands cannot be changed via `configureWorkflow`.

**pw-clone frontend**
- Replit injects `PORT=20318` at runtime for the `artifacts/pw-clone: web` workflow.
- This maps to external port 80 (the webview preview URL).
- Do NOT hardcode PORT=5000 in the dev script — the artifact `waitForPort` is 20318 and overriding it breaks the workflow restart.
- `vite.config.ts` proxy: `/api` → `http://localhost:8080` (the api-server port).

**api-server**
- The artifact `waitForPort` is 8080.
- The api-server's `index.ts` requires `PORT` env var — it throws without it.
- Fix applied: hardcode `PORT=8080` in `artifacts/api-server/package.json` dev script:
  `"dev": "export NODE_ENV=development PORT=8080 && pnpm run build && pnpm run start"`

**Why:**
Replit's artifact system assigns ports per-workflow; any mismatch between the actual listening port and `waitForPort` causes the workflow to time out with `DIDNT_OPEN_A_PORT`.

**How to apply:**
Always check workflow `waitForPort` before changing any PORT-related config. Run `getWorkflowStatus` to see the current `waitForPort` value before editing port configuration.
