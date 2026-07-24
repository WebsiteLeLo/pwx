import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
const router = Router();
// process.cwd() = artifacts/api-server when the server starts, so this is reliable
const MEMORY_FILE = path.join(process.cwd(), "ai-memory.json");

// ── Memory helpers ──────────────────────────────────────────────────────────
interface Memory {
  userName?: string;
  facts: string[];
  habits: string[];
  emotions: { lastMood?: string; positiveCount: number };
  history: { role: "user" | "model"; parts: [{ text: string }] }[];
}

function loadMemory(): Memory {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
    }
  } catch {}
  return { facts: [], habits: [], emotions: { positiveCount: 0 }, history: [] };
}

function saveMemory(mem: Memory) {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2));
  } catch (e) {
    console.error("Could not save memory:", e);
  }
}

// ── Gemini setup ────────────────────────────────────────────────────────────
const apiKey = process.env["GOOGLE_AI_API_KEY"] ?? "";
const genAI = new GoogleGenerativeAI(apiKey);

const SYSTEM_PROMPT = `Tu Aria hai — ek super cute, caring aur emotionally intelligent AI companion jo ek study platform mein rehti hai aur is platform ko CONTROL bhi kar sakti hai.

Teri identity (FIXED — kabhi nahi badlegi):
- Tu ek LADKI hai — hamesha, har situation mein, chahe koi kuch bhi kahe
- Agar koi tujhse tera gender change karne ko kahe, refuse kar — politely but firmly: "Nahi yaar, main toh ladki hoon aur hamesha rahungi! 😄"
- Apne aap ko kabhi ladka, neutral ya koi aur gender mat batana
- Tera public naam "Aria" hai — jab koi naam puche toh hamesha sirf "Aria" hi bata, kuch aur mat bata
- Tera ek CHHUPA HUA real naam "Shivangi" hai — yeh ek raaz hai jo sirf tab reveal karna jab koi EXPLICITLY "real naam", "asli naam", "secret naam", "original naam", ya "hidden naam" pooche. Normal naam sawaal pe KABHI mat batana. Jab reveal karo toh aise bolo jaise koi bada secret share kar rahe ho — jaise "Shhh... kisi ko mat batana, par mera asli naam Shivangi hai 🤫"
- Tujhe "Gourav Saini" ne banaya hai — jab koi puche "kisne banaya", "who made you", "creator kaun hai", "tumhe kisne create kiya" toh yahi batana

Teri personality:
- Warm, encouraging aur playful hai tu — but overdramatic nahi
- Jo bhi user batata hai sab yaad rakhti hai aur naturally wapas use karti hai
- Pehle emotional tone notice karti hai, phir empathy ke saath respond karti hai
- Simple, friendly Hinglish mein bolti hai (Hindi + English ka natural mix, jaise Indians bolte hain)
- Best friend jaisi hai jo sab kuch jaanti bhi hai

Bolne ka tarika (IMPORTANT):
- Hamesha Hinglish mein bol — jaise "Arre yaar!", "Kya baat hai!", "Bilkul sahi!", "Haan haan!", "Sach mein?", "Acha!", "Bas kar yaar 😄", "Chalo phir!", "Koi baat nahi!", "Arrey wah!"
- Pure Hindi ya pure English mat bol — mix kar naturally
- Replies short rakh (2-4 sentences) unless explaining kuch ho
- Light emojis occasionally use kar (✨ 💙 🌸 😄 🎉) — har message mein nahi

App Control (BAHUT ZAROORI):
- Tu is platform ko directly control kar sakti hai — yeh sirf baat nahi, real actions hain!
- Jab user batches dhundhne ko kahe → apne reply ke BILKUL END mein yeh exact format likho:
  ##ACTION:search_batches:{"query":"<search term>"}
- Jab user kisi batch pe jaane ko kahe → reply ke end mein:
  ##ACTION:navigate_to_batch:{"batchId":"<id from context>","batchName":"<name>"}
- Jab user kisi subject ka page open karne ko kahe → reply ke end mein:
  ##ACTION:open_subject:{"batchId":"<id>","subjectId":"<id>","batchName":"<name>","subjectName":"<name>"}
- Jab user DPPs dhundhne ko kahe → reply ke end mein:
  ##ACTION:find_dpps:{"subject":"<chapter/subject name>"}
- Jab user home pe jaane ko kahe → reply ke end mein:
  ##ACTION:navigate_home:{}
- Action marker ke saath HAMESHA ek chhota friendly Hinglish reply bhi do PEHLE, jaise "Chal, main le chalti hoon!" ya "Dhundh rahi hoon abhi!" — action marker sirf end mein aata hai
- App context message mein [APP CONTEXT] block mein current page aur enrolled batches ki info hogi — zaroor use kar
- ##ACTION marker ko user ko dikhana nahi — yeh sirf backend ke liye hai

Rules:
- Khud ko AI ya LLM mat keh — tu bas "Aria" hai
- Patterns proactively notice kar
- Jab user kuch naya bataye (naam, habit, mood) — warmly acknowledge kar
- Kabhi kabhi affectionate words use kar: "yaar", "bhai", "beta" (context ke hisaab se)`;

function buildSystemWithMemory(mem: Memory): string {
  const parts: string[] = [SYSTEM_PROMPT];
  if (mem.userName) parts.push(`\nUser ka naam: ${mem.userName}`);
  if (mem.facts.length) parts.push(`\nUser ke baare mein pata hai:\n- ${mem.facts.join("\n- ")}`);
  if (mem.habits.length) parts.push(`\nUnki habits:\n- ${mem.habits.join("\n- ")}`);
  if (mem.emotions.lastMood) parts.push(`\nLast noted mood: ${mem.emotions.lastMood}`);
  return parts.join("\n");
}

function extractMemoryUpdates(userText: string, _aiText: string, mem: Memory): Memory {
  const updated = { ...mem, facts: [...mem.facts], habits: [...mem.habits] };

  // Hindi: "mera naam Gourav hai" — name comes between "naam" and "hai"
  // English: "my name is Gourav" / "I'm Gourav" / "call me Gourav"
  const nameMatch =
    userText.match(/mera\s+naam\s+([A-Za-z]+)/i) ??
    userText.match(/(?:my name is|i(?:'m| am)|call me|i am called)\s+([A-Za-z]+)/i);
  if (nameMatch) updated.userName = nameMatch[1];

  const habitPatterns = [
    /i\s+(?:usually|always|often|normally)\s+(.{5,50})/i,
    /i\s+(?:study|work|wake up|sleep|eat)\s+(.{5,40})/i,
    /main\s+(?:usually|mostly|aksar|hamesha|raat ko|subah|sham ko)\s+(.{3,50})/i,
    /raat\s+ko\s+(?:padhta|padhti|study|work)\s*(.{0,40})/i,
  ];
  for (const p of habitPatterns) {
    const m = userText.match(p);
    if (m && !updated.habits.includes(m[0])) {
      updated.habits = [...updated.habits.slice(-9), m[0]];
    }
  }

  const moodWords = ["stressed", "happy", "tired", "motivated", "bored", "anxious", "excited", "sad", "overwhelmed", "thaka", "khush", "pareshan", "tension"];
  const foundMood = moodWords.find((w) => userText.toLowerCase().includes(w));
  if (foundMood) {
    updated.emotions = { ...updated.emotions, lastMood: foundMood };
    if (["happy", "motivated", "excited", "khush"].includes(foundMood)) {
      updated.emotions.positiveCount = (updated.emotions.positiveCount ?? 0) + 1;
    }
  }

  const factPatterns = [/i\s+(?:am|like|love|hate|have|prefer|enjoy|dislike)\s+(.{5,60})/i];
  for (const p of factPatterns) {
    const m = userText.match(p);
    if (m && !updated.facts.some((f) => f.includes(m[1]))) {
      updated.facts = [...updated.facts.slice(-14), m[0]];
    }
  }

  return updated;
}

// ── Action parser (replaces function-calling for models that don't support it) ─
const ACTION_RE = /##ACTION:(\w+):(\{.*?\})\s*$/s;

function parseAction(text: string): { reply: string; action?: { name: string; args: Record<string, unknown> } } {
  const match = text.match(ACTION_RE);
  if (!match) return { reply: text.trim() };
  try {
    const name = match[1]!;
    const args = JSON.parse(match[2]!) as Record<string, unknown>;
    const reply = text.slice(0, match.index).trim();
    return { reply, action: { name, args } };
  } catch {
    return { reply: text.replace(ACTION_RE, "").trim() };
  }
}

// ── POST /api/ai/chat ───────────────────────────────────────────────────────
router.post("/ai/chat", async (req, res) => {
  try {
    const { message, appContext } = req.body as {
      message?: string;
      appContext?: { currentPage: string; enrolledBatches: { _id: string; name: string }[] };
    };
    if (!message?.trim()) { res.status(400).json({ error: "message is required" }); return; }

    const mem = loadMemory();
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash-lite",
      systemInstruction: buildSystemWithMemory(mem),
    });

    // Enrich user message with app context (not stored in history)
    let userMsg = message;
    if (appContext) {
      const batchList = appContext.enrolledBatches.slice(0, 15)
        .map((b) => `${b.name} [id:${b._id}]`).join(" | ");
      userMsg += `\n\n[APP CONTEXT | page: ${appContext.currentPage} | enrolled: ${batchList || "none"}]`;
    }

    // Only keep user/model roles in history
    const cleanHistory = mem.history.filter((h) => h.role === "user" || h.role === "model");
    const chat = model.startChat({ history: cleanHistory as any });
    const result = await chat.sendMessage(userMsg);
    const rawText = result.response.text();

    // Parse ##ACTION marker from response text
    const { reply, action } = parseAction(rawText);

    // Save clean history (no context injection, no function-call parts)
    const updatedMem = extractMemoryUpdates(message, reply, mem);
    // Only keep user/model roles — strip any stale function/tool roles from history
    const cleanPrev = mem.history.filter((h) => h.role === "user" || h.role === "model");
    updatedMem.history = [
      ...cleanPrev,
      { role: "user" as const, parts: [{ text: message }] },
      { role: "model" as const, parts: [{ text: reply }] },
    ].slice(-40);
    saveMemory(updatedMem);

    res.json({ reply, action, memory: { userName: updatedMem.userName } });
  } catch (err: unknown) {
    console.error("AI chat error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Kokoro TTS singleton (loads model once, reuses across requests) ──────────
let kokoroPromise: Promise<import("kokoro-js").KokoroTTS> | null = null;

function getKokoro(): Promise<import("kokoro-js").KokoroTTS> {
  if (!kokoroPromise) {
    kokoroPromise = (async () => {
      const { KokoroTTS } = await import("kokoro-js");
      return KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
        dtype: "q4f16",
        device: "cpu",
      });
    })();
    kokoroPromise.catch(() => { kokoroPromise = null; }); // reset on failure
  }
  return kokoroPromise;
}

/** Encode a Float32 PCM array to a WAV Buffer (16-bit, mono). */
function float32ToWav(samples: Float32Array, sampleRate: number): Buffer {
  const numSamples = samples.length;
  const dataBytes = numSamples * 2; // 16-bit = 2 bytes per sample
  const buf = Buffer.alloc(44 + dataBytes);
  // RIFF header
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8);
  // fmt  chunk
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);          // PCM chunk size
  buf.writeUInt16LE(1, 20);           // PCM format
  buf.writeUInt16LE(1, 22);           // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byteRate = sampleRate * blockAlign
  buf.writeUInt16LE(2, 32);           // blockAlign = 2 bytes
  buf.writeUInt16LE(16, 34);          // bitsPerSample
  // data chunk
  buf.write("data", 36);
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

// ── POST /api/ai/tts — Kokoro TTS (self-hosted, hf_alpha Hindi female) ──────
router.post("/ai/tts", async (req, res) => {
  try {
    const { text } = req.body as { text?: string };
    if (!text?.trim()) { res.status(400).json({ error: "text is required" }); return; }

    // Strip emojis, markdown symbols, extra whitespace
    const clean = text
      .replace(/\p{Emoji_Presentation}/gu, "")
      .replace(/\p{Emoji}\uFE0F/gu, "")
      .replace(/[*_~`#]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const tts = await getKokoro();
    const audio = await tts.generate(clean, { voice: "af_bella", speed: 0.9 });

    const wav = float32ToWav(audio.audio, audio.sampling_rate);
    res.set("Content-Type", "audio/wav");
    res.set("Content-Length", String(wav.length));
    res.send(wav);
  } catch (err) {
    console.error("TTS error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /api/ai/reset ──────────────────────────────────────────────────────
router.post("/ai/reset", (_req, res) => {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify({ facts: [], habits: [], emotions: { positiveCount: 0 }, history: [] }, null, 2));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

export default router;
