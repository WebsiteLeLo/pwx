/**
 * Telegram Bot webhook handler.
 * Handles both PWX and Vibrant Academy access via start-parameter prefix:
 *   pwx_<sessionId>  → checks @pwxonrender channel
 *   ss_<sessionId>   → checks @studysquadpro channel
 */
import { Router } from "express";
import { getSession, setCode } from "../lib/tg-sessions";

const router = Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

// Channel config keyed by prefix
const APPS: Record<string, { channel: string; channelUrl: string; label: string }> = {
  pwx: {
    channel:    process.env.TELEGRAM_CHANNEL ?? "@pwxonrender",
    channelUrl: "https://t.me/pwxonrender",
    label:      "PWX",
  },
  ss: {
    channel:    process.env.STUDYSQUAD_CHANNEL ?? "@studysquadpro",
    channelUrl: "https://t.me/studysquadpro",
    label:      "Vibrant Academy",
  },
};

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

async function isMember(userId: number, channel: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(channel)}&user_id=${userId}`,
    );
    const json = (await res.json()) as { ok: boolean; result?: { status: string } };
    if (!json.ok) return false;
    const { status } = json.result!;
    return ["member", "administrator", "creator"].includes(status);
  } catch {
    return false;
  }
}

// POST /api/bot/webhook
router.post("/bot/webhook", async (req, res) => {
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
      const param = text.split(" ")[1]?.trim();

      if (!param) {
        await sendMessage(chatId,
          `👋 Namaste! Is bot ko directly use nahi kiya ja sakta.\n\nWebsite pe jaake "Access Code Paao" button dabaao.`
        );
        return;
      }

      // Parse prefix: "pwx_<uuid>" or "ss_<uuid>"
      const underscoreIdx = param.indexOf("_");
      const prefix    = underscoreIdx !== -1 ? param.slice(0, underscoreIdx) : "";
      const sessionId = underscoreIdx !== -1 ? param.slice(underscoreIdx + 1) : param;
      const app       = APPS[prefix];

      if (!app) {
        await sendMessage(chatId,
          `⏰ Yeh link expire ho gaya hai.\n\nWebsite pe wapas jaao aur naya code request karo.`
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

      const member = await isMember(userId, app.channel);
      if (!member) {
        await sendMessage(chatId,
          `❌ Aap abhi <b>${app.channel}</b> channel ke member nahi hain.\n\n` +
          `Pehle channel join karo:\n${app.channelUrl}\n\n` +
          `Join karne ke baad wapas website pe aao aur dobara try karo.`
        );
        return;
      }

      const code = randomCode();
      await setCode(sessionId, code, userId, userName);

      await sendMessage(chatId,
        `✅ Channel membership confirm ho gayi!\n\n` +
        `Aapka ${app.label} access code hai:\n\n` +
        `<b>🔑 ${code}</b>\n\n` +
        `⚠️ Yeh code sirf <b>5 minute</b> ke liye valid hai.\n` +
        `Website pe jaao aur yeh code enter karo.`
      );
      return;
    }

    await sendMessage(chatId,
      `Website pe "Access Code Paao" button dabaao.`
    );
  } catch (err) {
    console.error("Bot webhook error:", err);
  }
});

// GET /api/bot/setup-webhook  (one-time setup, call once after deploy)
router.get("/bot/setup-webhook", async (req, res) => {
  const domain = req.query.domain as string | undefined;
  if (!domain) {
    return res.status(400).json({ ok: false, error: "?domain= required" });
  }
  const webhookUrl = `${domain}/api/bot/webhook`;
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
