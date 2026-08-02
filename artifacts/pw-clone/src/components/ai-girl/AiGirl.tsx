import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Mic, MicOff, RotateCcw, ExternalLink, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "./AiGirl.css";
import { emitAriaAction, type DppResult } from "@/lib/ariaEventBus";

// AI backend base — empty string in dev (Vite proxy handles /api/*),
// set VITE_AI_API_URL to the Render backend URL in production.
const AI_BASE = (import.meta.env.VITE_AI_API_URL ?? "").replace(/\/$/, "");
const aiUrl = (path: string) => `${AI_BASE}${path}`;
const PW_API = "https://pwsecure.gourav23032009.workers.dev/api/pw";

// ── Types ────────────────────────────────────────────────────────────────────
type GirlState = "idle" | "talking" | "thinking";
type Message = { role: "user" | "aria"; text: string; id: number; dppResults?: DppResult[]; dppSubject?: string };

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

// ── Edge TTS via server — one continuous Hinglish stream ────────────────────
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

// ── DPP search across enrolled batches ───────────────────────────────────────
/** Fetch all pages of topics for a subject (up to maxPages). */
async function fetchAllTopics(batchId: string, subId: string, maxPages = 8): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    try {
      const json = await fetch(
        `${PW_API}/v2/batches/${batchId}/subject/${subId}/topics?page=${page}`
      ).then((r) => r.json());
      // API returns { data: Topic[] } — data is the array directly
      const page_topics: any[] = Array.isArray(json.data) ? json.data : [];
      if (page_topics.length === 0) break;
      all.push(...page_topics);
      if (page_topics.length < 10) break; // last page
    } catch { break; }
  }
  return all;
}

/** Fuzzy match: every word in query must appear in target. */
function topicMatches(topicName: string, query: string): boolean {
  const t = topicName.toLowerCase();
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((w) => t.includes(w));
}

async function executeFindDpps(subject: string): Promise<DppResult[]> {
  const raw = localStorage.getItem("pwx_enrolled_batches");
  const enrolled: { _id: string; name: string }[] = raw ? JSON.parse(raw) : [];
  if (!enrolled.length) return [];

  const results: DppResult[] = [];
  for (const batch of enrolled.slice(0, 5)) {
    try {
      const detJson = await fetch(`${PW_API}/v3/batches/${batch._id}/details`).then((r) => r.json());
      const subjects: any[] = detJson.data?.subjects ?? [];
      for (const sub of subjects) {
        try {
          const topics = await fetchAllTopics(batch._id, sub._id);
          for (const topic of topics) {
            const hasDpp = (topic.exercises ?? 0) > 0 || (topic.notes ?? 0) > 0;
            if (hasDpp && topicMatches(topic.name ?? "", subject)) {
              results.push({
                batchId: batch._id,
                batchName: batch.name,
                subjectId: sub._id,
                subjectName: sub.subject,
                topicId: topic._id,
                topicName: topic.name,
                dppCount: topic.exercises ?? topic.notes ?? 1,
              });
            }
          }
        } catch { /* skip subject on error */ }
        if (results.length >= 20) break;
      }
    } catch { /* skip batch on error */ }
    if (results.length >= 20) break;
  }
  return results;
}

// ── DPP result card ──────────────────────────────────────────────────────────
function DppResultCard({ results, subject }: { results: DppResult[]; subject: string }) {
  if (!results.length) {
    return (
      <p className="text-slate-500 text-xs mt-1.5 italic">
        "{subject}" ke liye koi DPP nahi mili enrolled batches mein.
      </p>
    );
  }
  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-[11px] font-semibold text-violet-600 mb-1">
        🔍 {results.length} DPP topic{results.length > 1 ? "s" : ""} mile:
      </p>
      {results.map((r, i) => (
        <Link
          key={i}
          href={`/batch/${r.batchId}/subject/${r.subjectId}`}
          className="flex items-center gap-2 p-2 rounded-xl bg-violet-50 border border-violet-100 hover:bg-violet-100 transition-colors cursor-pointer group"
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{r.topicName}</p>
            <p className="text-[10px] text-slate-500 truncate">
              {r.batchName} · {r.subjectName} · {r.dppCount} DPPs
            </p>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-violet-400 group-hover:text-violet-600 flex-shrink-0" />
        </Link>
      ))}
    </div>
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
          <>
            <div className="aria-message prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-1">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {msg.text}
              </ReactMarkdown>
            </div>
            {msg.dppResults !== undefined && (
              <DppResultCard results={msg.dppResults} subject={msg.dppSubject ?? ""} />
            )}
          </>
        ) : (
          msg.text
        )}
      </div>
    </motion.div>
  );
}

// ── Draggable button position ─────────────────────────────────────────────────
const ARIA_POS_KEY = "aria-btn-pos";
const BTN_SIZE = 64; // px (w-16 h-16)

function loadBtnPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(ARIA_POS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { x: number; y: number };
      if (typeof p.x === "number" && typeof p.y === "number") return p;
    }
  } catch {}
  // Default: bottom-right (computed on first render)
  return { x: -1, y: -1 }; // sentinel → resolved in useEffect
}

function clampPos(x: number, y: number): { x: number; y: number } {
  const margin = 8;
  const maxX = window.innerWidth - BTN_SIZE - margin;
  const maxY = window.innerHeight - BTN_SIZE - margin;
  return {
    x: Math.max(margin, Math.min(x, maxX)),
    y: Math.max(margin, Math.min(y, maxY)),
  };
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

  const [, navigate] = useLocation();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const msgIdRef = useRef(
    messages.length > 0 ? Math.max(...messages.map((m) => m.id)) + 1 : 1
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<InstanceType<typeof window.SpeechRecognition> | null>(null);

  // ── Draggable position ──────────────────────────────────────────────────────
  const [btnPos, setBtnPos] = useState<{ x: number; y: number }>(loadBtnPos);
  const dragState = useRef<{
    dragging: boolean;
    startPX: number; startPY: number; // pointer start
    startBX: number; startBY: number; // btn pos start
    moved: boolean;
  } | null>(null);

  // Resolve sentinel default to bottom-right on first mount
  useEffect(() => {
    setBtnPos((p) => {
      if (p.x === -1) {
        const def = clampPos(
          window.innerWidth - BTN_SIZE - 16,
          window.innerHeight - BTN_SIZE - 16
        );
        return def;
      }
      return p;
    });
  }, []);

  // Track visible viewport (shrinks when mobile keyboard opens)
  const [vv, setVv] = useState(() => ({
    width:     window.visualViewport?.width  ?? window.innerWidth,
    height:    window.visualViewport?.height ?? window.innerHeight,
    offsetTop: window.visualViewport?.offsetTop ?? 0,
  }));
  useEffect(() => {
    const vp = window.visualViewport;
    if (!vp) return;
    const update = () => setVv({ width: vp.width, height: vp.height, offsetTop: vp.offsetTop });
    vp.addEventListener("resize", update);
    vp.addEventListener("scroll", update);
    return () => { vp.removeEventListener("resize", update); vp.removeEventListener("scroll", update); };
  }, []);

  // Re-clamp when window is resized
  useEffect(() => {
    const onResize = () => setBtnPos((p) => clampPos(p.x, p.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button / first touch
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = {
      dragging: true,
      startPX: e.clientX, startPY: e.clientY,
      startBX: btnPos.x,  startBY: btnPos.y,
      moved: false,
    };
  }, [btnPos]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragState.current;
    if (!ds?.dragging) return;
    const dx = e.clientX - ds.startPX;
    const dy = e.clientY - ds.startPY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) ds.moved = true;
    if (!ds.moved) return;
    const next = clampPos(ds.startBX + dx, ds.startBY + dy);
    setBtnPos(next);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragState.current;
    if (!ds) return;
    dragState.current = null;
    if (ds.moved) {
      // Snap to nearest edge so button never floats in the middle
      setBtnPos((p) => {
        const margin = 8;
        const distLeft   = p.x - margin;
        const distRight  = window.innerWidth - BTN_SIZE - margin - p.x;
        const distTop    = p.y - margin;
        const distBottom = window.innerHeight - BTN_SIZE - margin - p.y;
        const min = Math.min(distLeft, distRight, distTop, distBottom);
        let snapped: { x: number; y: number };
        if (min === distRight)       snapped = { x: window.innerWidth - BTN_SIZE - margin, y: p.y };
        else if (min === distLeft)   snapped = { x: margin, y: p.y };
        else if (min === distBottom) snapped = { x: p.x, y: window.innerHeight - BTN_SIZE - margin };
        else                          snapped = { x: p.x, y: margin };
        try { localStorage.setItem(ARIA_POS_KEY, JSON.stringify(snapped)); } catch {}
        return snapped;
      });
    } else {
      // It was a tap/click — toggle panel
      setOpen((v) => !v);
    }
  }, []);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    saveChatToStorage(messages);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) {
      // Scroll to latest message when panel opens
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "instant" }), 50);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  const addMessage = useCallback(
    (role: "user" | "aria", text: string, extra?: { dppResults?: DppResult[]; dppSubject?: string }) => {
      const id = msgIdRef.current++;
      setMessages((prev) => [...prev, { role, text, id, ...extra }]);
      return id;
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;
      setInput("");
      addMessage("user", text);
      setLoading(true);
      setGirlState("thinking");

      try {
        // Build app context — enrolled batches for Aria to reference
        let enrolledBatches: { _id: string; name: string }[] = [];
        try {
          const raw = localStorage.getItem("pwx_enrolled_batches");
          if (raw) enrolledBatches = JSON.parse(raw);
        } catch { /* ignore */ }

        const res = await fetch(aiUrl("/api/ai/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            appContext: { currentPage: window.location.pathname, enrolledBatches },
          }),
        });

        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) throw new Error("backend_not_configured");

        let data: {
          reply?: string;
          error?: string;
          memory?: { userName?: string };
          action?: { name: string; args: Record<string, unknown> };
        };
        try {
          data = await res.json();
        } catch {
          throw new Error(res.status === 503 ? "server_waking" : "bad_response");
        }

        if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
        const reply = data.reply ?? "Yaar, kuch toh gadbad ho gayi!";
        if (data.memory?.userName) setUserName(data.memory.userName);

        // ── Execute app action BEFORE showing reply ──────────────────────────
        if (data.action) {
          const { name, args } = data.action;
          switch (name) {
            case "search_batches":
              emitAriaAction({ type: "search_batches", query: String(args.query ?? "") });
              navigate("/");
              break;
            case "navigate_to_batch":
              navigate(`/batch/${args.batchId}`);
              break;
            case "open_subject":
              navigate(`/batch/${args.batchId}/subject/${args.subjectId}`);
              break;
            case "navigate_home":
              navigate("/");
              break;
            case "find_dpps": {
              const subject = String(args.subject ?? "");
              // Show reply + searching indicator immediately
              const audio0 = await prepareSpeech(reply);
              addMessage("aria", reply);
              setGirlState("talking");
              await playAudio(audio0, reply, () => setGirlState("idle"));
              setLoading(false);
              // Async DPP search — add results card when done
              executeFindDpps(subject).then((dppResults) => {
                const resultText = dppResults.length
                  ? `"${subject}" ke ${dppResults.length} DPP topics mile enrolled batches mein:`
                  : `Yaar, "${subject}" ke liye koi DPP topic nahi mila enrolled batches mein.`;
                addMessage("aria", resultText, { dppResults, dppSubject: subject });
              });
              return; // early return — audio already played
            }
          }
        }
        // ────────────────────────────────────────────────────────────────────

        const audio = await prepareSpeech(reply);
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
    [loading, addMessage, navigate]
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
    rec.onresult = (e: any) => {
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

  const resetMemory = () => {
    window.speechSynthesis?.cancel();
    const freshMsg: Message = {
      role: "aria",
      text: "Chat clear kar di! ✨ Bata, kya poochu?",
      id: msgIdRef.current++,
    };
    setMessages([freshMsg]);
    setGirlState("idle");
  };

  const statusLabel =
    girlState === "thinking" ? "soch rahi hoon…" :
    girlState === "talking"  ? "bol rahi hoon…"  : "available";
  const statusDot =
    girlState === "thinking" ? "bg-yellow-400 animate-pulse" :
    girlState === "talking"  ? "bg-green-400 animate-pulse"  : "bg-white/60";

  const isMobile = vv.width < 640;

  // Desktop panel style — positioned near the button
  const desktopPanelStyle = (() => {
    const margin = 8;
    const panelW = Math.min(384, vv.width - margin * 2);
    const panelH = Math.min(600, vv.height * 0.75);
    const btnBottom = btnPos.y + BTN_SIZE;
    const spaceAbove = btnPos.y - vv.offsetTop;
    const spaceBelow = vv.offsetTop + vv.height - btnBottom;
    const openAbove = spaceAbove > spaceBelow && spaceAbove > panelH + 8;
    const top = openAbove ? btnPos.y - panelH - 8 : btnBottom + 8;
    const left = Math.max(margin, Math.min(btnPos.x, vv.width - panelW - margin));
    return { position: "fixed" as const, top, left, width: panelW, maxHeight: panelH, zIndex: 49 };
  })();

  return (
    <>
      {/* ── Mobile trigger: clean pill button above bottom nav ── */}
      {isMobile ? (
        <motion.button
          onClick={() => setOpen((v) => !v)}
          whileTap={{ scale: 0.93 }}
          style={{
            position: "fixed",
            bottom: "calc(56px + env(safe-area-inset-bottom) + 10px)",
            right: 14,
            zIndex: 50,
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg border transition-colors touch-manipulation ${
            open
              ? "bg-violet-600 border-violet-500 text-white"
              : "bg-background border-violet-500/60 text-violet-400 hover:bg-violet-500/10"
          }`}
          aria-label={open ? "Close Aria" : "Chat with Aria"}
        >
          {open ? (
            <X className="w-4 h-4" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span className="text-sm font-semibold leading-none">Aria</span>
          {!open && (
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          )}
        </motion.button>
      ) : (
        /* ── Desktop: draggable video circle ── */
        <div
          style={{
            position: "fixed",
            left: btnPos.x,
            top: btnPos.y,
            width: BTN_SIZE,
            height: BTN_SIZE,
            zIndex: 50,
            touchAction: "none",
            cursor: "grab",
            userSelect: "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          title={open ? "Aria band karo (drag karke move karo)" : "Aria se baat karo (drag karke move karo)"}
        >
          <motion.div
            className="w-full h-full rounded-full overflow-hidden shadow-2xl border-2 border-violet-400/70 bg-violet-900"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            style={{ pointerEvents: "none" }}
          >
            {open ? (
              <div className="w-full h-full bg-gradient-to-br from-violet-700 to-purple-900 flex items-center justify-center">
                <X className="w-6 h-6 text-white/80" />
              </div>
            ) : (
              <>
                <GirlVideo state="idle" className="w-full h-full object-cover object-top" />
                <span className="absolute inset-0 rounded-full ring-2 ring-violet-400 animate-ping opacity-40 pointer-events-none" />
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Mobile backdrop */}
            {isMobile && (
              <motion.div
                key="aria-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
                onClick={() => setOpen(false)}
              />
            )}

            {/* Chat panel — bottom sheet on mobile, floating on desktop */}
            <motion.div
              key="aria-panel"
              initial={isMobile ? { y: "100%" } : { opacity: 0, y: 24, scale: 0.97 }}
              animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
              exit={isMobile ? { y: "100%" } : { opacity: 0, y: 24, scale: 0.97 }}
              transition={isMobile
                ? { type: "spring", stiffness: 320, damping: 32 }
                : { type: "spring", stiffness: 300, damping: 28 }
              }
              className="flex flex-col overflow-hidden shadow-2xl"
              style={isMobile ? {
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                height: `${vv.height * 0.82}px`,
                zIndex: 50,
                borderRadius: "20px 20px 0 0",
              } : desktopPanelStyle}
            >
              {/* ── Header ── */}
              <div className="relative flex-shrink-0 bg-violet-900 overflow-hidden"
                style={{ height: isMobile ? 120 : 160 }}>

                {/* Drag handle (mobile only) */}
                {isMobile && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/30" />
                )}

                <GirlVideo state={girlState} className="absolute inset-0 w-full h-full object-cover object-top" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-violet-800/80" />

                {/* Status pill */}
                <div className="absolute top-5 left-3">
                  <span className="flex items-center gap-1.5 bg-black/30 backdrop-blur-sm rounded-full px-2.5 py-0.5 text-xs text-white/90">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                    {statusLabel}
                  </span>
                </div>

                {/* Controls */}
                <div className="absolute top-4 right-2 flex gap-1.5">
                  <button onClick={resetMemory} title="Chat clear karo"
                    className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white/80 hover:text-white transition-colors touch-manipulation">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setOpen(false)}
                    className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white/80 hover:text-white transition-colors touch-manipulation">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Name tag */}
                <div className="absolute bottom-2.5 left-3 text-white">
                  <p className="font-semibold text-sm leading-none">Aria ✨</p>
                  {userName && <p className="text-xs text-white/70 mt-0.5">Hey {userName}!</p>}
                </div>
              </div>

              {/* ── Messages ── */}
              <div className="flex-1 overflow-y-auto bg-violet-50/98 px-3 py-3 min-h-0 overscroll-contain">
                {messages.map((msg) => (
                  <Bubble key={msg.id} msg={msg} />
                ))}
                {loading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start mb-2">
                    <div className="bg-white/90 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm flex gap-1 items-center">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </motion.div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* ── Input ── */}
              <form onSubmit={handleSubmit}
                className="flex items-center gap-2 px-3 py-2.5 bg-white border-t border-violet-100 flex-shrink-0">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={userName ? `Bolo ${userName}…` : "Kuch bhi poocho…"}
                  disabled={loading || listening}
                  className="flex-1 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-violet-400/50 disabled:opacity-60 transition"
                  style={{ fontSize: "16px" }}
                />
                <button type="button" onClick={listening ? stopListening : startListening} disabled={loading}
                  className={`p-2.5 rounded-xl transition-colors touch-manipulation flex-shrink-0 ${
                    listening ? "bg-red-100 text-red-500 animate-pulse" : "bg-violet-100 text-violet-500 hover:bg-violet-200"
                  }`}>
                  {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button type="submit" disabled={!input.trim() || loading}
                  className="p-2.5 rounded-xl bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-40 transition-colors touch-manipulation flex-shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: new (...args: any[]) => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: new (...args: any[]) => any;
  }
}
