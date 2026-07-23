import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Mic, MicOff, RotateCcw, MessageCircleHeart } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type GirlState = "idle" | "talking" | "thinking";
type Message = { role: "user" | "aria"; text: string; id: number };

// ── TTS helper (browser speech synthesis) ───────────────────────────────────
function speak(text: string, onEnd?: () => void) {
  if (!window.speechSynthesis) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);

  // Pick the best available female / cute voice
  const pickVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const preferred = [
      "Google US English Female",
      "Microsoft Aria Online (Natural)",
      "Microsoft Jenny Online (Natural)",
      "Google UK English Female",
      "Samantha",
    ];
    for (const name of preferred) {
      const v = voices.find((v) => v.name.toLowerCase().includes(name.toLowerCase()));
      if (v) return v;
    }
    return voices.find((v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("female"))
      ?? voices.find((v) => v.lang.startsWith("en"))
      ?? null;
  };

  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = 1.05;
  utterance.pitch = 1.2;
  utterance.volume = 1;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}

// ── Video component ──────────────────────────────────────────────────────────
function GirlVideo({ state }: { state: GirlState }) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const src = `${base}/ai-girl/${state}.mp4`;

  const videoRef = useRef<HTMLVideoElement>(null);
  const prevState = useRef<GirlState>(state);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (prevState.current !== state) {
      prevState.current = state;
      video.src = src;
      video.load();
    }
    video.play().catch(() => {});
  }, [state, src]);

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      loop
      muted
      playsInline
      className="w-full h-full object-cover"
    />
  );
}

// ── Chat bubble ──────────────────────────────────────────────────────────────
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
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-snug shadow-sm ${
          isAria
            ? "bg-white/90 text-slate-800 rounded-tl-sm"
            : "bg-violet-500 text-white rounded-tr-sm"
        }`}
      >
        {msg.text}
      </div>
    </motion.div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function AiGirl() {
  const [open, setOpen] = useState(false);
  const [girlState, setGirlState] = useState<GirlState>("idle");
  const [messages, setMessages] = useState<Message[]>([
    { role: "aria", text: "Hey! I'm Aria ✨ I'm here to study with you and keep you company. What's on your mind?", id: 0 },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const msgIdRef = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  const addMessage = useCallback((role: "user" | "aria", text: string): number => {
    const id = msgIdRef.current++;
    setMessages((prev) => [...prev, { role, text, id }]);
    return id;
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setInput("");
    addMessage("user", text);
    setLoading(true);
    setGirlState("thinking");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json() as { reply?: string; error?: string; memory?: { userName?: string } };

      if (data.error) throw new Error(data.error);
      const reply = data.reply ?? "Sorry, I didn't catch that!";
      if (data.memory?.userName) setUserName(data.memory.userName);

      addMessage("aria", reply);
      setGirlState("talking");
      speak(reply, () => setGirlState("idle"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong 😔";
      addMessage("aria", `Oops! ${msg}`);
      setGirlState("idle");
    } finally {
      setLoading(false);
    }
  }, [loading, addMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) sendMessage(input.trim());
  };

  // Voice input
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
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
    await fetch("/api/ai/reset", { method: "POST" });
    setMessages([{ role: "aria", text: "Memory cleared! Fresh start ✨ What would you like to talk about?", id: msgIdRef.current++ }]);
    setUserName(null);
  };

  return (
    <>
      {/* Floating avatar button */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full overflow-hidden shadow-2xl border-2 border-violet-400/60 focus:outline-none"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        title={open ? "Close Aria" : "Chat with Aria"}
      >
        <GirlVideo state={open ? girlState : "idle"} />
        {/* Pulse ring when idle & closed */}
        {!open && (
          <span className="absolute inset-0 rounded-full ring-2 ring-violet-400 animate-ping opacity-40 pointer-events-none" />
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="aria-panel"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed bottom-[5.5rem] right-6 z-50 w-80 sm:w-96 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            style={{ maxHeight: "80vh" }}
          >
            {/* Header with video */}
            <div className="relative bg-gradient-to-br from-violet-600 via-purple-600 to-pink-500 flex-shrink-0">
              {/* Video preview top */}
              <div className="relative h-36 overflow-hidden">
                <GirlVideo state={girlState} />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-violet-700/80" />

                {/* Status badge */}
                <div className="absolute top-2 left-3">
                  <span className="flex items-center gap-1.5 bg-black/30 backdrop-blur-sm rounded-full px-2.5 py-0.5 text-xs text-white/90">
                    <span className={`w-1.5 h-1.5 rounded-full ${girlState === "thinking" ? "bg-yellow-400 animate-pulse" : girlState === "talking" ? "bg-green-400 animate-pulse" : "bg-white/70"}`} />
                    {girlState === "thinking" ? "thinking…" : girlState === "talking" ? "speaking…" : "ready"}
                  </span>
                </div>

                {/* Controls */}
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <button
                    onClick={resetMemory}
                    title="Clear memory"
                    className="p-1.5 rounded-full bg-black/30 backdrop-blur-sm text-white/80 hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1.5 rounded-full bg-black/30 backdrop-blur-sm text-white/80 hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Name */}
                <div className="absolute bottom-2 left-3 text-white">
                  <p className="font-semibold text-sm leading-none">Aria</p>
                  {userName && <p className="text-xs text-white/70 mt-0.5">Hey, {userName}!</p>}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-violet-50/95 backdrop-blur-md px-3 py-3 min-h-0">
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
                placeholder={userName ? `Say anything, ${userName}…` : "Type a message…"}
                disabled={loading || listening}
                className="flex-1 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-violet-400/50 disabled:opacity-60 transition"
              />
              <button
                type="button"
                onClick={listening ? stopListening : startListening}
                disabled={loading}
                className={`p-2 rounded-xl transition-colors ${listening ? "bg-red-100 text-red-500" : "bg-violet-100 text-violet-500 hover:bg-violet-200"}`}
                title={listening ? "Stop listening" : "Voice input"}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2 rounded-xl bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-40 transition-colors"
                title="Send"
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

// Extend window for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
