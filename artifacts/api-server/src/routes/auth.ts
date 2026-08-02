import { Router } from "express";
import crypto from "crypto";

const router = Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const CHANNEL = process.env.TELEGRAM_CHANNEL ?? "@pwxonrender";

function verifyTelegramHash(data: Record<string, string>): boolean {
  const { hash, ...rest } = data;
  if (!hash) return false;
  const checkString = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("\n");
  const secretKey = crypto.createHash("sha256").update(BOT_TOKEN).digest();
  const hmac = crypto
    .createHmac("sha256", secretKey)
    .update(checkString)
    .digest("hex");
  return hmac === hash;
}

// POST /api/auth/telegram
// Verifies Telegram Login Widget data and checks channel membership
router.post("/auth/telegram", async (req, res) => {
  try {
    const data = req.body as Record<string, string>;

    if (!data.hash || !data.id || !data.auth_date) {
      return res.status(400).json({ ok: false, reason: "invalid_data" });
    }

    // auth_date must not be older than 1 day
    const authDate = parseInt(data.auth_date, 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      return res.status(400).json({ ok: false, reason: "expired" });
    }

    // Verify HMAC hash
    if (!verifyTelegramHash(data)) {
      return res.status(403).json({ ok: false, reason: "invalid_hash" });
    }

    if (!BOT_TOKEN) {
      return res.status(500).json({ ok: false, reason: "bot_not_configured" });
    }

    // Check channel membership via Telegram Bot API
    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(CHANNEL)}&user_id=${data.id}`,
    );
    const tgJson = (await tgRes.json()) as {
      ok: boolean;
      result?: { status: string };
      description?: string;
    };

    if (!tgJson.ok) {
      // Bot is not admin / not in channel — log and deny
      console.warn("getChatMember failed:", tgJson.description);
      return res.status(200).json({
        ok: false,
        reason: "bot_error",
        detail: tgJson.description,
      });
    }

    const { status } = tgJson.result!;
    const isMember = ["member", "administrator", "creator"].includes(status);

    if (!isMember) {
      return res.status(200).json({ ok: false, reason: "not_member" });
    }

    return res.status(200).json({
      ok: true,
      user: {
        id: data.id,
        name: [data.first_name, data.last_name].filter(Boolean).join(" "),
        username: data.username ?? null,
        photo: data.photo_url ?? null,
      },
    });
  } catch (err) {
    console.error("Telegram auth error:", err);
    return res.status(500).json({ ok: false, reason: "server_error" });
  }
});

export default router;
