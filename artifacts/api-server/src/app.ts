import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import fs from "node:fs";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { createSsrMiddleware, getSitemapXml } from "./lib/seo";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api", router);
app.use(router);

// Dynamic sitemap — served at root so Googlebot finds it without a redirect
app.get("/sitemap.xml", (_req, res) => {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(getSitemapXml());
});

// In production, serve the built Vite frontend only when dist/public exists.
// In API-only deployments (no frontend bundled), skip static/SSR and expose a clean root health check.
if (process.env.NODE_ENV === "production") {
  const frontendDist = path.resolve(
    import.meta.dirname,
    "../../pw-clone/dist/public",
  );

  if (fs.existsSync(path.join(frontendDist, "index.html"))) {
    // Serve static assets (JS, CSS, images) with long-lived cache headers
    app.use(
      express.static(frontendDist, {
        index: false, // Don't auto-serve index.html; SSR middleware injects meta first
        maxAge: "1y",
        immutable: true,
      }),
    );

    // SPA catch-all: inject per-route meta into index.html for every non-file request
    const ssrMiddleware = createSsrMiddleware(frontendDist);
    app.get("/{*path}", ssrMiddleware);
  } else {
    app.get("/", (_req, res) => {
      res.json({ status: "ok", service: "pwx-api", mode: "api-only" });
    });
  }
}

export default app;
