import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
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

// Dynamic sitemap — served at root so Googlebot finds it without a redirect
app.get("/sitemap.xml", (_req, res) => {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(getSitemapXml());
});

// In production, Express serves the built Vite output with SSR meta injection.
// In dev, Vite dev server handles the frontend; this block is skipped entirely.
if (process.env.NODE_ENV === "production") {
  const frontendDist = path.resolve(
    import.meta.dirname,
    "../../pw-clone/dist/public",
  );

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
}

export default app;
