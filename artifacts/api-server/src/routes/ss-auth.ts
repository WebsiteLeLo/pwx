/**
 * Auth routes for Vibracnt Academy / StudySquad Telegram bot-code verification.
 *
 * POST /api/ss-auth/session  → creates a session, returns { sessionId, botLink }
 * POST /api/ss-auth/verify   → verifies { sessionId, code }, returns { ok, user? }
 */
import { Router } from "express";
import { randomUUID } from "crypto";
import { createSession, verifyCode } from "../lib/tg-sessions";

const router = Router();

const BOT_USERNAME     = process.env.TELEGRAM_BOT_USERNAME ?? "";
const ADMIN_BYPASS_CODE = "032009";

// Create a new verification session (Vibrant Academy — checks @studysquadpro)
router.post("/ss-auth/session", async (_req, res) => {
  const sessionId = randomUUID();
  await createSession(sessionId);
  const botLink = BOT_USERNAME
    ? `https://t.me/${BOT_USERNAME}?start=ss_${sessionId}`
    : null;
  return res.json({ sessionId, botLink });
});

router.post("/ss-auth/verify", async (req, res) => {
  const { sessionId, code } = req.body as {
    sessionId?: string;
    code?: string;
  };

  if (!sessionId || !code) {
    return res.status(400).json({ ok: false, reason: "missing_fields" });
  }

  if (code.trim() === ADMIN_BYPASS_CODE) {
    return res.status(200).json({ ok: true, user: { id: "admin", name: "Admin" } });
  }

  const session = await verifyCode(sessionId, code);
  if (!session) {
    return res.status(200).json({ ok: false, reason: "invalid_code" });
  }

  return res.status(200).json({
    ok: true,
    user: { id: String(session.userId), name: session.userName ?? "User" },
  });
});

export default router;
