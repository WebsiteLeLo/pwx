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

// Create a new verification session
router.post("/auth/session", (_req, res) => {
  const sessionId = randomUUID();
  createSession(sessionId);
  const botLink = `https://t.me/${BOT_USERNAME}?start=${sessionId}`;
  return res.json({ sessionId, botLink });
});

// Verify the code entered by the user
router.post("/auth/verify", (req, res) => {
  const { sessionId, code } = req.body as {
    sessionId?: string;
    code?: string;
  };

  if (!sessionId || !code) {
    return res.status(400).json({ ok: false, reason: "missing_fields" });
  }

  const session = verifyCode(sessionId, code);
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
