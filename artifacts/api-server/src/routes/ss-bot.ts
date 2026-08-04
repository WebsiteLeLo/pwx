/**
 * Telegram Bot webhook handler for StudySquad / Vibracnt Academy.
 * Checks @studysquadpro channel membership and issues a 6-digit code.
 *
 * POST /api/ss-bot/webhook
 * GET  /api/ss-bot/setup-webhook?domain=https://...
 */
import { Router } from "express";
import { createSession, getSession, setCode } from "../lib/tg-sessions";

const router = Router();

const BOT_TOKEN   = process.env.STUDYSQUAD_BOT_TOKEN ?? "";
const CHANNEL     = process.env.STUDYSQUAD_CHANNEL ?? "@studysquadpro";
const CHANNEL_URL = "https://t.me/studysquadpro";

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendMessage(chatId: number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

async function isMember(userId: number): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(CHANNEL)}&user_id=${userId}`,
    );
    const json = (await res.json()) as { ok: boolean; result?: { status: string } };
    if (!json.ok) return false;
    const { status } = json.result!;
    return ["member", "administrator", "creator"].includes(status);
  } catch {
    return false;
  }
}

// POST /api/ss-bot/webhook
router.post("/ss-bot/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const update = req.body as {
      message?: {
        text?: string;
        from?: { id: number; first_name?: string };
        chat?: { id: number };
      };
    };

    const msg = update.message;
    if (!msg?.text || !msg.from || !msg.chat) return;

    const text     = msg.text.trim();
    const userId   = msg.from.id;
    const chatId   = msg.chat.id;
    const userName = msg.from.first_name ?? "User";

    if (text.startsWith("/start")) {
      const parts     = text.split(" ");
      const sessionId = parts[1]?.trim();

      if (!sessionId) {
        await sendMessage(chatId,
          `👋 Namaste! Is bot ko directly use nahi kiya ja sakta.\n\nVibracnt Academy pe jaake "Access Code Paao" button dabaao.`
        );
        return;
      }

      const session = await getSession(sessionId);
      if (!session) {
        await sendMessage(chatId,
          `⏰ Yeh link expire ho gaya hai.\n\nWebsite pe wapas jaao aur naya code request karo.`
        );
        return;
      }

      const member = await isMember(userId);
      if (!member) {
        await sendMessage(chatId,
          `❌ Aap abhi <b>${CHANNEL}</b> channel ke member nahi hain.\n\n` +
          `Pehle channel join karo:\n${CHANNEL_URL}\n\n` +
          `Join karne ke baad wapas website pe aao aur dobara try karo.`
        );
        return;
      }

      const code = randomCode();
      await setCode(sessionId, code, userId, userName);

      await sendMessage(chatId,
        `✅ Channel membership confirm ho gayi!\n\n` +
        `Aapka Vibracnt Academy access code hai:\n\n` +
        `<b>🔑 ${code}</b>\n\n` +
        `⚠️ Yeh code sirf <b>5 minute</b> ke liye valid hai.\n` +
        `Website pe jaao aur yeh code enter karo.`
      );
      return;
    }

    await sendMessage(chatId,
      `Vibracnt Academy pe jaao aur "Access Code Paao" button dabaao.`
    );
  } catch (err) {
    console.error("SS bot webhook error:", err);
  }
});

// GET /api/ss-bot/setup-webhook?domain=https://...
router.get("/ss-bot/setup-webhook", async (req, res) => {
  const domain = req.query.domain as string | undefined;
  if (!domain) return res.status(400).json({ ok: false, error: "?domain= required" });

  const webhookUrl = `${domain}/api/ss-bot/webhook`;
  const tgRes = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    },
  );
  const json = await tgRes.json();
  return res.json(json);
});

export default router;
