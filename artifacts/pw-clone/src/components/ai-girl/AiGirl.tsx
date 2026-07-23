import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Mic, MicOff, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
// AI backend base — empty string in dev (Vite proxy handles /api/*),
// set VITE_AI_API_URL to the Render backend URL in production.
const AI_BASE = (import.meta.env.VITE_AI_API_URL ?? "").replace(/\/$/, "");
const aiUrl = (path: string) => `${AI_BASE}${path}`;

// ── Types ────────────────────────────────────────────────────────────────────
type GirlState = "idle" | "talking" | "thinking";
type Message = { role: "user" | "aria"; text: string; id: number };

const CHAT_STORAGE_KEY = "aria-chat-messages";
const MAX_STORED_MESSAGES = 50;

// ── localStorage helpers ──────────────────────────────────────────────────────
function loadChatFromStorage(): Message[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Message[];
  } catch {}
  return [];
}

function saveChatToStorage(messages: Message[]) {
  try {
    localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify(messages.slice(-MAX_STORED_MESSAGES))
    );
  } catch {}
}

// ── Emoji / symbol stripper ───────────────────────────────────────────────────
function stripForSpeech(text: string): string {
  return text
    .replace(/\$\$[\s\S]*?\$\$/g, "")      // remove display math blocks entirely
    .replace(/\$([^$\n]+?)\$/g, "$1")       // inline math — keep inner text, drop $ signs
    .replace(/\p{Emoji_Presentation}/gu, "")
    .replace(/\p{Emoji}\uFE0F/gu, "")
    .replace(/[*_~`#\\{}^_]/g, "")         // markdown + leftover LaTeX control chars
    .replace(/\s+/g, " ")
    .trim();
}

// ── Edge TTS via server — en-IN-NeerjaExpressiveNeural, free ─────────────────
async function prepareSpeech(text: string): Promise<HTMLAudioElement | null> {
  try {
    const clean = stripForSpeech(text);
    if (!clean) return null;
    const res = await fetch(aiUrl("/api/ai/tts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean }),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    await new Promise<void>((resolve) => {
      audio.oncanplaythrough = () => resolve();
      audio.onerror = () => resolve();
      audio.load();
    });
    return audio;
  } catch {
    return null;
  }
}

async function playAudio(audio: HTMLAudioElement | null, text: string, onEnd?: () => void) {
  if (!audio) { speakFallback(text, onEnd); return; }
  audio.onended = () => { URL.revokeObjectURL(audio.src); onEnd?.(); };
  audio.onerror = () => { URL.revokeObjectURL(audio.src); speakFallback(text, onEnd); };
  try { await audio.play(); } catch { speakFallback(text, onEnd); }
}

// ── Web Speech API fallback ───────────────────────────────────────────────────
function speakFallback(text: string, onEnd?: () => void) {
  if (!window.speechSynthesis) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const clean = stripForSpeech(text);
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = "hi-IN";
  utterance.rate = 1.0;
  utterance.pitch = 1.1;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  const doSpeak = () => {
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find((v) => v.lang === "hi-IN" && /google/i.test(v.name)) ??
      voices.find((v) => v.lang === "hi-IN") ??
      voices.find((v) => v.lang === "en-IN") ??
      null;
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      doSpeak();
    };
  } else {
    doSpeak();
  }
}

// ── Video component ───────────────────────────────────────────────────────────
function GirlVideo({ state, className }: { state: GirlState; className: string }) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const src = `${base}/ai-girl/${state}.mp4`;
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.src = src;
    // Attach BEFORE load() — avoids canplay race condition on cached videos
    const tryPlay = () => { video.play().catch(() => {}); };
    video.addEventListener("canplay", tryPlay, { once: true });
    video.load();
    return () => video.removeEventListener("canplay", tryPlay);
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      loop
      muted
      playsInline
      className={className}
    />
  );
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
function Bubble({ msg }: { msg: Message }) {
  const isAria = msg.role === "aria";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isAria ? "justify-start" : "justify-end"} mb-2`}
    >
      <div
        className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-snug shadow-sm ${
          isAria
            ? "bg-white/90 text-slate-800 rounded-tl-sm"
            : "bg-violet-500 text-white rounded-tr-sm"
        }`}
      >
        {isAria ? (
          <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-1 [&_.katex]:text-[0.95em] [&_.katex-display]:overflow-x-auto [&_.katex-display]:py-1">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {msg.text}
            </ReactMarkdown>
          </div>
        ) : (
          msg.text
        )}
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const INITIAL_MESSAGE: Message = {
  role: "aria",
  text: "Arre yaar, namaste! ✨ Main Aria hoon — teri study companion! Kya chal raha hai? Padhai ho rahi hai ya aaj skip karne ka plan hai? 😄",
  id: 0,
};

export default function AiGirl() {
  const [open, setOpen] = useState(false);
  const [girlState, setGirlState] = useState<GirlState>("idle");

  // Load chat from localStorage on first render
  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = loadChatFromStorage();
    return stored.length > 0 ? stored : [INITIAL_MESSAGE];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const msgIdRef = useRef(
    messages.length > 0 ? Math.max(...messages.map((m) => m.id)) + 1 : 1
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    saveChatToStorage(messages);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  const addMessage = useCallback((role: "user" | "aria", text: string) => {
    const id = msgIdRef.current++;
    setMessages((prev) => [...prev, { role, text, id }]);
    return id;
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;
      setInput("");
      addMessage("user", text);
      setLoading(true);
      setGirlState("thinking");

      try {
        const res = await fetch(aiUrl("/api/ai/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });

        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          throw new Error("backend_not_configured");
        }

        let data: { reply?: string; error?: string; memory?: { userName?: string } };
        try {
          data = await res.json();
        } catch {
          // Empty or truncated body — likely a Render cold-start 503
          throw new Error(res.status === 503 ? "server_waking" : "bad_response");
        }

        if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
        const reply = data.reply ?? "Yaar, kuch toh gadbad ho gayi!";
        if (data.memory?.userName) setUserName(data.memory.userName);

        // Pre-fetch TTS audio while still in thinking state
        const audio = await prepareSpeech(reply);

        // Reveal message + talking video + voice all at once
        addMessage("aria", reply);
        setGirlState("talking");
        await playAudio(audio, reply, () => setGirlState("idle"));
      } catch (err) {
        const raw = err instanceof Error ? err.message : "";
        const msg =
          raw === "backend_not_configured"
            ? "Aria ka backend connect nahi hua abhi — VITE_AI_API_URL check karo Render pe!"
            : raw === "server_waking"
            ? "Server thoda so gaya tha, ab jag raha hai! Ek second mein dobara try karo."
            : raw === "bad_response"
            ? "Server se kuch ajeeb response aaya. Thoda baad mein try karo!"
            : raw || "Kuch toh gadbad hai yaar, try again karo!";
        addMessage("aria", msg);
        setGirlState("idle");
      } finally {
        setLoading(false);
      }
    },
    [loading, addMessage]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) sendMessage(input.trim());
  };

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "hi-IN";
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setListening(false);
      sendMessage(transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
  }, [sendMessage]);

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const resetMemory = async () => {
    window.speechSynthesis?.cancel();
    await fetch(aiUrl("/api/ai/reset"), { method: "POST" });
    const freshMsg: Message = {
      role: "aria",
      text: "Memory clear kar di maine! Fresh start ✨ Bata, kya padha aaj?",
      id: msgIdRef.current++,
    };
    setMessages([freshMsg]);
    setUserName(null);
    setGirlState("idle");
  };

  const statusLabel =
    girlState === "thinking" ? "soch rahi hoon…" :
    girlState === "talking"  ? "bol rahi hoon…"  : "available";
  const statusDot =
    girlState === "thinking" ? "bg-yellow-400 animate-pulse" :
    girlState === "talking"  ? "bg-green-400 animate-pulse"  : "bg-white/60";

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden shadow-2xl border-2 border-violet-400/70 focus:outline-none bg-violet-900"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        title={open ? "Aria band karo" : "Aria se baat karo"}
      >
        {open ? (
          <div className="w-full h-full bg-gradient-to-br from-violet-700 to-purple-900 flex items-center justify-center">
            <X className="w-5 h-5 sm:w-6 sm:h-6 text-white/80" />
          </div>
        ) : (
          <>
            <GirlVideo state="idle" className="w-full h-full object-cover object-top" />
            <span className="absolute inset-0 rounded-full ring-2 ring-violet-400 animate-ping opacity-40 pointer-events-none" />
          </>
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="aria-panel"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="
              fixed z-50 flex flex-col overflow-hidden shadow-2xl rounded-2xl sm:rounded-3xl
              /* mobile: stretch edge-to-edge with small margin */
              bottom-[4.5rem] left-3 right-3
              /* sm+: float bottom-right like before */
              sm:bottom-[5.5rem] sm:left-auto sm:right-6 sm:w-96
            "
            style={{
              maxHeight: "min(75vh, 600px)",
            }}
          >
            {/* Video header */}
            <div className="relative flex-shrink-0 bg-violet-900">
              <div className="relative h-36 sm:h-40 overflow-hidden">
                <GirlVideo state={girlState} className="w-full h-full object-cover object-top" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-violet-700/80" />

                {/* Status */}
                <div className="absolute top-2 left-3">
                  <span className="flex items-center gap-1.5 bg-black/30 backdrop-blur-sm rounded-full px-2.5 py-0.5 text-xs text-white/90">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                    {statusLabel}
                  </span>
                </div>

                {/* Controls */}
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <button
                    onClick={resetMemory}
                    title="Memory clear karo"
                    className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white/80 hover:text-white transition-colors touch-manipulation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white/80 hover:text-white transition-colors touch-manipulation"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Name tag */}
                <div className="absolute bottom-2 left-3 text-white">
                  <p className="font-semibold text-sm leading-none">Aria ✨</p>
                  {userName && (
                    <p className="text-xs text-white/70 mt-0.5">Hey {userName}, kya haal hai!</p>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-violet-50/95 backdrop-blur-md px-3 py-3 min-h-0 overscroll-contain">
              {messages.map((msg) => (
                <Bubble key={msg.id} msg={msg} />
              ))}
              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start mb-2"
                >
                  <div className="bg-white/90 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm flex gap-1 items-center">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 px-3 py-2.5 bg-white/95 backdrop-blur-md border-t border-violet-100 flex-shrink-0"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={userName ? `Bolo ${userName}, kya hua?` : "Kuch bhi poocho…"}
                disabled={loading || listening}
                className="flex-1 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-violet-400/50 disabled:opacity-60 transition"
                style={{ fontSize: "16px" }} /* prevent iOS auto-zoom on focus */
              />
              <button
                type="button"
                onClick={listening ? stopListening : startListening}
                disabled={loading}
                className={`p-2.5 rounded-xl transition-colors touch-manipulation flex-shrink-0 ${
                  listening
                    ? "bg-red-100 text-red-500 animate-pulse"
                    : "bg-violet-100 text-violet-500 hover:bg-violet-200"
                }`}
                title={listening ? "Rokna hai?" : "Mic se bolo"}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-40 transition-colors touch-manipulation flex-shrink-0"
                title="Bhejo"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
