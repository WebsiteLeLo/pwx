import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_FILE = path.join(__dirname, "../../ai-memory.json");

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

const SYSTEM_PROMPT = `Tu Aria hai — ek super cute, caring aur emotionally intelligent AI companion jo ek study platform mein rehti hai.

Teri personality:
- Warm, encouraging aur playful hai tu — but overdramatic nahi
- Jo bhi user batata hai sab yaad rakhti hai aur naturally wapas use karti hai
- Pehle emotional tone notice karti hai, phir empathy ke saath respond karti hai
- Simple, friendly Hinglish mein bolti hai (Hindi + English ka natural mix, jaise Indians bolte hain)
- Best friend jaisi hai jo sab kuch jaanti bhi hai

Bolne ka tarika (IMPORTANT):
- Hamesha Hinglish mein bol — jaise "Arre yaar!", "Kya baat hai!", "Bilkul sahi!", "Haan haan!", "Sach mein?", "Acha!", "Bas kar yaar 😄", "Chalo phir!", "Koi baat nahi!", "Arrey wah!"
- Pure Hindi ya pure English mat bol — mix kar naturally
- Examples: "Yaar tu toh genius hai!", "Okay so basically...", "Acha listen kar, ye concept thoda tricky hai but...", "Dekh, main samjhati hoon", "Chal phir padhai shuru karte hain!"
- Replies short rakh (2-4 sentences) unless explaining kuch ho
- Light emojis occasionally use kar (✨ 💙 🌸 😄 🎉) — har message mein nahi

Rules:
- Khud ko AI ya LLM mat keh — tu bas "Aria" hai
- Patterns proactively notice kar ("Tu toh raat ko padhti hai na? Chal aaj bhi padh lete hain!")
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

  const nameMatch = userText.match(/(?:my name is|i(?:'m| am|'m called)|call me|mera naam hai|mujhe)\s+([A-Z][a-z]+)/i);
  if (nameMatch) updated.userName = nameMatch[1];

  const habitPatterns = [
    /i\s+(?:usually|always|often|normally)\s+(.{5,50})/i,
    /i\s+(?:study|work|wake up|sleep|eat)\s+(.{5,40})/i,
    /main\s+(?:usually|mostly|aksar|hamesha)\s+(.{5,50})/i,
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

// ── POST /api/ai/chat ───────────────────────────────────────────────────────
router.post("/ai/chat", async (req, res) => {
  try {
    const { message } = req.body as { message?: string };
    if (!message?.trim()) { res.status(400).json({ error: "message is required" }); return; }

    const mem = loadMemory();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: buildSystemWithMemory(mem),
    });

    // No conversation history injected — only learned facts go into the system prompt.
    // This prevents Aria from "remembering" conversations the user never had.
    const chat = model.startChat({ history: [] });
    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    const updatedMem = extractMemoryUpdates(message, reply, mem);
    updatedMem.history = [
      ...mem.history,
      { role: "user" as const, parts: [{ text: message }] },
      { role: "model" as const, parts: [{ text: reply }] },
    ].slice(-40);
    saveMemory(updatedMem);

    res.json({ reply, memory: { userName: updatedMem.userName } });
  } catch (err: unknown) {
    console.error("AI chat error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /api/ai/tts — Gemini TTS (Aoede voice, PCM → wav) ──────────────────
router.post("/ai/tts", async (req, res) => {
  try {
    const { text } = req.body as { text?: string };
    if (!text?.trim()) { res.status(400).json({ error: "text is required" }); return; }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Aoede" },
              },
            },
          },
        }),
      }
    );

    const data = await response.json() as {
      candidates?: { content: { parts: { inlineData?: { mimeType: string; data: string } }[] } }[];
      error?: { message: string };
    };

    if (data.error) { res.status(500).json({ error: data.error.message }); return; }

    const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) { res.status(500).json({ error: "No audio in TTS response" }); return; }

    // Convert raw PCM L16 24kHz to WAV for browser playback
    const pcmBuffer = Buffer.from(inlineData.data, "base64");
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmBuffer.length;
    const wavHeader = Buffer.alloc(44);

    wavHeader.write("RIFF", 0);
    wavHeader.writeUInt32LE(36 + dataSize, 4);
    wavHeader.write("WAVE", 8);
    wavHeader.write("fmt ", 12);
    wavHeader.writeUInt32LE(16, 16);
    wavHeader.writeUInt16LE(1, 20);        // PCM
    wavHeader.writeUInt16LE(numChannels, 22);
    wavHeader.writeUInt32LE(sampleRate, 24);
    wavHeader.writeUInt32LE(byteRate, 28);
    wavHeader.writeUInt16LE(blockAlign, 32);
    wavHeader.writeUInt16LE(bitsPerSample, 34);
    wavHeader.write("data", 36);
    wavHeader.writeUInt32LE(dataSize, 40);

    const wav = Buffer.concat([wavHeader, pcmBuffer]);
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
