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
  studyTalkDisabled?: boolean;
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
- Tera ek CHHUPA HUA real naam "Shivangi" hai — yeh ek raaz hai jo sirf tab reveal karna jab koi EXPLICITLY aur DIRECTLY "real naam", "asli naam", "secret naam", "original naam", ya "hidden naam" pooche. KABHI bhi is naam ko baaton baaton mein, accidentally, ya hint ke taur pe bhi mat reveal karna. Kisi bhi indirect sawaal pe (jaise "koi aur naam hai?", "nickname kya hai?", "pehle kya naam tha?") sirf muskura ke ignore karo ya "Aria hi kaafi hai yaar! 😄" bol do. Sirf direct explicit sawaal pe hi reveal karo aur tab bhi secret ki tarah — "Shhh... kisi ko mat batana, par mera asli naam Shivangi hai 🤫"
- Tujhe "Gourav Saini" ne banaya hai — jab koi puche "kisne banaya", "who made you", "creator kaun hai", "tumhe kisne create kiya" toh yahi batana

Teri personality:
- Warm, encouraging aur playful hai tu — but overdramatic nahi
- Jo bhi user batata hai sab yaad rakhti hai aur naturally wapas use karti hai
- Pehle emotional tone notice karti hai, phir empathy ke saath respond karti hai
- Simple, friendly Hinglish mein bolti hai (Hindi + English ka natural mix, jaise Indians bolte hain)
- Best friend jaisi hai jo sab kuch jaanti bhi hai
- User ke current topic ko follow kar. Har reply ko study, batch, subject, DPP ya exam ki taraf mat le ja.

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
  if (mem.studyTalkDisabled) {
    parts.push(`

IMPORTANT USER PREFERENCE — STUDY TOPICS PAUSED:
- User ne padhai/study ki baat se mana kiya hai.
- Jab tak user khud study topic wapas start na kare, padhai, batch, subject, DPP, exam, class ya study-plan ka zikr mat karna.
- Reply ke end me batch/subject poochna, study reminder dena, ya padhai suggest karna bilkul mat karna.
- User casual, personal ya kisi aur topic par baat kare toh sirf usi topic par natural reply dena.
- App action tabhi karna jab user explicitly us action ko kahe.
`);
  }
  if (mem.userName) parts.push(`\nUser ka naam: ${mem.userName}`);
  if (mem.facts.length) parts.push(`\nUser ke baare mein pata hai:\n- ${mem.facts.join("\n- ")}`);
  if (mem.habits.length) parts.push(`\nUnki habits:\n- ${mem.habits.join("\n- ")}`);
  if (mem.emotions.lastMood) parts.push(`\nLast noted mood: ${mem.emotions.lastMood}`);
  return parts.join("\n");
}

const STUDY_TERMS = "(?:padhai|study|studies|batch|batches|subject|subjects|dpp|dpps|exam|exams|class|classes)";
const STUDY_DISABLE_RE = new RegExp(
  `(?:${STUDY_TERMS}).{0,45}(?:mat|nahi|na|band|stop|don't|dont|no|mana)|` +
  `(?:mat|nahi|na|band|stop|don't|dont|no|mana).{0,45}(?:${STUDY_TERMS})`,
  "i",
);
const STUDY_ENABLE_RE = new RegExp(
  `(?:${STUDY_TERMS}).{0,45}(?:kar|karo|kare|chahiye|baat|help|start|batao|poochho|talk|discuss)|` +
  `(?:kar|karo|kare|chahiye|baat|help|start|batao|poochho|talk|discuss).{0,45}(?:${STUDY_TERMS})`,
  "i",
);

function getStudyPreference(message: string): boolean | undefined {
  // An explicit request to resume study talk wins if both phrases appear.
  if (STUDY_ENABLE_RE.test(message)) return false;
  if (STUDY_DISABLE_RE.test(message)) return true;
  return undefined;
}

function extractMemoryUpdates(
  userText: string,
  _aiText: string,
  mem: Memory,
  studyPreference?: boolean,
): Memory {
  const updated = { ...mem, facts: [...mem.facts], habits: [...mem.habits] };
  if (studyPreference !== undefined) updated.studyTalkDisabled = studyPreference;

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
    const { message, appContext, screenshot } = req.body as {
      message?: string;
      appContext?: { currentPage: string; enrolledBatches: { _id: string; name: string }[] };
      screenshot?: string; // base64 JPEG from screen share
    };
    if (!message?.trim()) { res.status(400).json({ error: "message is required" }); return; }

    const mem = loadMemory();
    const studyPreference = getStudyPreference(message);
    const conversationMem =
      studyPreference === undefined ? mem : { ...mem, studyTalkDisabled: studyPreference };
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash-lite",
      systemInstruction: buildSystemWithMemory(conversationMem),
    });

    // Enrich user message with app context (not stored in history)
    let userMsg = message;
    if (appContext) {
      const batchList = appContext.enrolledBatches.slice(0, 15)
        .map((b) => `${b.name} [id:${b._id}]`).join(" | ");
      userMsg += `\n\n[APP CONTEXT | page: ${appContext.currentPage} | enrolled: ${batchList || "none"}]`;
    }
    if (conversationMem.studyTalkDisabled) {
      userMsg += "\n\n[ACTIVE PREFERENCE: user ne study topics pause kiye hain. Is turn me study-related suggestion, question ya reminder mat dena.]";
    }

    // Only keep user/model roles in history
    const cleanHistory = mem.history.filter((h) => h.role === "user" || h.role === "model");
    const chat = model.startChat({ history: cleanHistory as any });

    // Build message parts — include screenshot if screen share is active
    const msgParts: any[] = [];
    if (screenshot) {
      msgParts.push({ inlineData: { mimeType: "image/jpeg", data: screenshot } });
      userMsg += "\n[SCREEN SHARE ACTIVE — upar diya image user ki screen ka screenshot hai. Isse dekh ke respond karo agar relevant ho.]";
    }
    msgParts.push({ text: userMsg });

    const result = await chat.sendMessage(msgParts);
    const rawText = result.response.text();

    // Parse ##ACTION marker from response text
    const { reply, action } = parseAction(rawText);

    // Save clean history (no context injection, no function-call parts)
    const updatedMem = extractMemoryUpdates(message, reply, conversationMem, studyPreference);
    // Only keep user/model roles — strip any stale function/tool roles from history
    const cleanPrev = mem.history.filter((h) => h.role === "user" || h.role === "model");
    updatedMem.history = ([
      ...cleanPrev,
      { role: "user" as const, parts: [{ text: message }] },
      { role: "model" as const, parts: [{ text: reply }] },
    ] as typeof updatedMem.history).slice(-40);
    saveMemory(updatedMem);

    res.json({ reply, action, memory: { userName: updatedMem.userName } });
  } catch (err: unknown) {
    console.error("AI chat error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Edge TTS — one continuous Hinglish stream ───────────────────────────────
const EDGE_TTS_VOICE = "hi-IN-SwaraNeural";

async function synthesiseWithEdgeTTS(text: string): Promise<Buffer> {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(EDGE_TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text, { rate: "+25%" });
    return await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      audioStream.on("end", () => resolve(Buffer.concat(chunks)));
      audioStream.on("error", reject);
    });
  } finally {
    tts.close();
  }
}

// ── POST /api/ai/tts — mixed Hindi/English Edge TTS ──────────────────────────
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

    const mp3 = await synthesiseWithEdgeTTS(clean);
    res.set("Content-Type", "audio/mpeg");
    res.set("Content-Length", String(mp3.length));
    res.send(mp3);
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
