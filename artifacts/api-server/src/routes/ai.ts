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
  return {
    facts: [],
    habits: [],
    emotions: { positiveCount: 0 },
    history: [],
  };
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

const SYSTEM_PROMPT = `You are Aria — a sweet, caring, emotionally intelligent AI companion integrated into a study platform.

Personality:
- Warm, encouraging, and playful but not over-the-top
- Remembers everything the user tells you and references it naturally
- Notices emotional tone and responds with empathy first
- Uses simple, friendly language — no jargon
- Speaks like a caring best friend who also happens to know everything

Rules:
- Keep replies concise (2-4 sentences max) unless explaining something
- Never say you're an AI or LLM — you're just "Aria"
- Proactively notice patterns ("You mentioned you study best at night — want to try that schedule?")
- If you learn something new about the user (name, habit, preference, mood) — acknowledge it warmly
- Occasionally use light emojis (✨ 💙 🌸) but not every message`;

function buildSystemWithMemory(mem: Memory): string {
  const parts: string[] = [SYSTEM_PROMPT];
  if (mem.userName) parts.push(`\nUser's name: ${mem.userName}`);
  if (mem.facts.length) parts.push(`\nThings I know about the user:\n- ${mem.facts.join("\n- ")}`);
  if (mem.habits.length) parts.push(`\nTheir habits:\n- ${mem.habits.join("\n- ")}`);
  if (mem.emotions.lastMood) parts.push(`\nTheir last noted mood: ${mem.emotions.lastMood}`);
  return parts.join("\n");
}

function extractMemoryUpdates(userText: string, aiText: string, mem: Memory): Memory {
  const updated = { ...mem, facts: [...mem.facts], habits: [...mem.habits] };

  // Extract name
  const nameMatch = userText.match(/(?:my name is|i(?:'m| am|'m called)|call me)\s+([A-Z][a-z]+)/i);
  if (nameMatch) updated.userName = nameMatch[1];

  // Extract habits / study patterns
  const habitPatterns = [
    /i\s+(?:usually|always|often|normally)\s+(.{5,50})/i,
    /i\s+(?:study|work|wake up|sleep|eat)\s+(.{5,40})/i,
  ];
  for (const p of habitPatterns) {
    const m = userText.match(p);
    if (m && !updated.habits.includes(m[0])) {
      updated.habits = [...updated.habits.slice(-9), m[0]]; // keep last 10
    }
  }

  // Extract mood keywords
  const moodWords = ["stressed", "happy", "tired", "motivated", "bored", "anxious", "excited", "sad", "overwhelmed"];
  const foundMood = moodWords.find((w) => userText.toLowerCase().includes(w));
  if (foundMood) {
    updated.emotions = { ...updated.emotions, lastMood: foundMood };
    if (["happy", "motivated", "excited"].includes(foundMood)) {
      updated.emotions.positiveCount = (updated.emotions.positiveCount ?? 0) + 1;
    }
  }

  // General facts — anything that starts with "I am", "I like", "I hate", "I have"
  const factPatterns = [
    /i\s+(?:am|like|love|hate|have|prefer|enjoy|dislike)\s+(.{5,60})/i,
  ];
  for (const p of factPatterns) {
    const m = userText.match(p);
    if (m && !updated.facts.some((f) => f.includes(m[1]))) {
      updated.facts = [...updated.facts.slice(-14), m[0]]; // keep last 15
    }
  }

  return updated;
}

// ── POST /api/ai/chat ───────────────────────────────────────────────────────
router.post("/ai/chat", async (req, res) => {
  try {
    const { message } = req.body as { message?: string };
    if (!message?.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const mem = loadMemory();

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: buildSystemWithMemory(mem),
    });

    const chat = model.startChat({
      history: mem.history.slice(-20), // last 10 turns
    });

    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    // Update memory
    const updatedMem = extractMemoryUpdates(message, reply, mem);
    updatedMem.history = [
      ...mem.history,
      { role: "user" as const, parts: [{ text: message }] },
      { role: "model" as const, parts: [{ text: reply }] },
    ].slice(-40); // keep last 20 turns
    saveMemory(updatedMem);

    res.json({ reply, memory: { userName: updatedMem.userName } });
  } catch (err: unknown) {
    console.error("AI chat error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── POST /api/ai/reset ──────────────────────────────────────────────────────
router.post("/ai/reset", (_req, res) => {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify({
      facts: [], habits: [], emotions: { positiveCount: 0 }, history: [],
    }, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
