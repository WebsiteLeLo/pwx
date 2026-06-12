import { Router } from "express";

const ogRouter = Router();

const PW_API = "https://pwsecure.gourav23032009.workers.dev/api/pw";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

ogRouter.get("/og/batch/:batchId", async (req, res) => {
  const { batchId } = req.params;
  const frontendOrigin = process.env["FRONTEND_URL"] ?? "https://pwx.onrender.com";
  const batchUrl = `${frontendOrigin}/batch/${batchId}`;

  let title = "PWX — JEE & NEET Video Player";
  let description = "Watch Physics Wallah batches, live classes & DPP quizzes.";
  let imageUrl = "https://cdn.pw.live/subjects/pwicons/PW.png";

  try {
    const r = await fetch(`${PW_API}/v3/batches/${batchId}/details`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PWX-OG/1.0)" },
    });
    if (r.ok) {
      const json: any = await r.json();
      const d = json?.data ?? {};
      if (d.name) {
        title = `${d.name} — PWX`;
        description = `Watch ${d.name} batch on PWX — JEE & NEET video lectures, live classes & DPP quizzes.`;
      }
      if (d.previewImage?.baseUrl && d.previewImage?.key) {
        imageUrl = `${d.previewImage.baseUrl}${d.previewImage.key}`;
      } else if (d.image?.baseUrl && d.image?.key) {
        imageUrl = `${d.image.baseUrl}${d.image.key}`;
      }
    }
  } catch {
    // use defaults
  }

  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeImage = escapeHtml(imageUrl);
  const safeUrl = escapeHtml(batchUrl);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(`<!DOCTYPE html>
<html prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}" />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="${safeUrl}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:image:width" content="512" />
  <meta property="og:image:height" content="512" />
  <meta property="og:site_name" content="PWX" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
  <meta name="twitter:image" content="${safeImage}" />

  <meta http-equiv="refresh" content="0; url=${safeUrl}" />
</head>
<body>
  <script>window.location.replace(${JSON.stringify(batchUrl)});</script>
  <p>Redirecting… <a href="${safeUrl}">${safeTitle}</a></p>
</body>
</html>`);
});

export default ogRouter;
