/**
 * Auth routes for Telegram bot-code verification flow.
 *
 * POST /api/auth/session   → creates a new session, returns { sessionId }
 * POST /api/auth/verify    → verifies { sessionId, code }, returns { ok, user? }
 */
import { Router } from "express";
import { randomUUID } from "crypto";
import { createSession, verifyCode } from "../lib/tg-sessions";

const router = Router();

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "pwxsubscribebot";
const ADMIN_BYPASS_CODE = "032009";

// Create a new verification session (PWX — checks @pwxonrender)
router.post("/auth/session", async (_req, res) => {
  const sessionId = randomUUID();
  await createSession(sessionId);
  const botLink = `https://t.me/${BOT_USERNAME}?start=pwx_${sessionId}`;
  return res.json({ sessionId, botLink });
});

// Verify the code entered by the user
router.post("/auth/verify", async (req, res) => {
  const { sessionId, code } = req.body as {
    sessionId?: string;
    code?: string;
  };

  if (!sessionId || !code) {
    return res.status(400).json({ ok: false, reason: "missing_fields" });
  }

  // Admin bypass — skip Telegram session check
  if (code.trim() === ADMIN_BYPASS_CODE) {
    return res.status(200).json({
      ok: true,
      user: { id: "admin", name: "Admin" },
    });
  }

  const session = await verifyCode(sessionId, code);
  if (!session) {
    return res.status(200).json({ ok: false, reason: "invalid_code" });
  }

  return res.status(200).json({
    ok: true,
    user: {
      id: String(session.userId),
      name: session.userName ?? "User",
    },
  });
});

export default router;
