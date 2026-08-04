import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";

// ── localStorage helpers ─────────────────────────────────────────────────────
const SS_AUTH_KEY     = "ss_tg_auth";
const SS_SESSION_KEY  = "ss_tg_session";
const EXPIRY_MS       = 7 * 24 * 60 * 60 * 1000;

interface SSStoredAuth { user: { id: string; name: string }; expires: number; }

function getSSAuth(): SSStoredAuth | null {
  try {
    const raw = localStorage.getItem(SS_AUTH_KEY);
    if (!raw) return null;
    const auth = JSON.parse(raw) as SSStoredAuth;
    if (Date.now() > auth.expires) { localStorage.removeItem(SS_AUTH_KEY); return null; }
    return auth;
  } catch { return null; }
}

function getSSSavedSession(): { sessionId: string; botLink: string } | null {
  try {
    const raw = sessionStorage.getItem(SS_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── Telegram SVG ─────────────────────────────────────────────────────────────
function TgIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

// ── StudySquad Gate Modal ────────────────────────────────────────────────────
type SSStep   = "join" | "code";
type SSStatus = "idle" | "loading" | "invalid_code" | "session_error" | "error";

function StudySquadGate({ onClose, onSuccess }: { onClose: () => void; onSuccess: (user: { id: string; name: string }) => void }) {
  const [step,           setStep]           = useState<SSStep>("join");
  const [sessionId,      setSessionId]      = useState<string | null>(() => getSSSavedSession()?.sessionId ?? null);
  const [botLink,        setBotLink]        = useState<string | null>(() => getSSSavedSession()?.botLink ?? null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [code,           setCode]           = useState("");
  const [status,         setStatus]         = useState<SSStatus>("idle");

  const createSession = useCallback(async () => {
    setSessionLoading(true);
    try {
      const res  = await fetch("/api/ss-auth/session", { method: "POST" });
      const json = (await res.json()) as { sessionId: string; botLink: string | null };
      setSessionId(json.sessionId);
      setBotLink(json.botLink);
      if (json.botLink) {
        sessionStorage.setItem(SS_SESSION_KEY, JSON.stringify({ sessionId: json.sessionId, botLink: json.botLink }));
      }
    } catch {
      setSessionId(null); setBotLink(null);
    } finally {
      setSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getSSSavedSession()) createSession();
  }, [createSession]);

  const handleGetCode = useCallback(() => {
    if (botLink) window.open(botLink, "_blank");
    setStep("code");
  }, [botLink]);

  const handleVerify = useCallback(async () => {
    if (!code.trim()) return;
    if (!sessionId) { setStatus("session_error"); return; }
    setStatus("loading");
    try {
      const res  = await fetch("/api/ss-auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, code: code.trim() }),
      });
      const json = (await res.json()) as { ok: boolean; reason?: string; user?: { id: string; name: string } };
      if (json.ok && json.user) {
        const stored: SSStoredAuth = { user: json.user, expires: Date.now() + EXPIRY_MS };
        localStorage.setItem(SS_AUTH_KEY, JSON.stringify(stored));
        sessionStorage.removeItem(SS_SESSION_KEY);
        onSuccess(json.user);
      } else if (json.reason === "invalid_code") {
        setStatus("invalid_code");
      } else {
        setStatus("error");
      }
    } catch { setStatus("error"); }
  }, [sessionId, code, onSuccess]);

  const handleNewSession = useCallback(async () => {
    setCode(""); setStatus("idle"); setStep("join");
    sessionStorage.removeItem(SS_SESSION_KEY);
    setSessionId(null); setBotLink(null);
    await createSession();
  }, [createSession]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#7c3aed,#a855f7,#7c3aed)" }} />
        <div className="p-7">
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}>
              <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === "join" ? (
              <motion.div key="join" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.22 }}>
                <h2 className="text-white text-xl font-bold text-center mb-1">Vibrant Academy</h2>
                <p className="text-zinc-400 text-sm text-center mb-6 leading-relaxed">
                  To get access, you must join the{" "}
                  <a href="https://t.me/studysquadpro" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300">@studysquadpro</a>{" "}
                  Telegram channel.
                </p>
                <div className="space-y-2 mb-6">
                  <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white mt-0.5" style={{ background: "#7c3aed" }}>1</span>
                    <div>
                      <p className="text-white text-sm font-medium">Join the Channel</p>
                      <a href="https://t.me/studysquadpro" target="_blank" rel="noopener noreferrer" className="text-violet-400 text-xs hover:underline">t.me/studysquadpro →</a>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white mt-0.5" style={{ background: "#7c3aed" }}>2</span>
                    <div>
                      <p className="text-white text-sm font-medium">Get Access Code</p>
                      <p className="text-zinc-500 text-xs">Press the button below → Telegram bot opens → receive your code</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleGetCode}
                  disabled={!botLink}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}
                >
                  <TgIcon className="w-4 h-4" />
                  {sessionLoading ? "Loading..." : botLink ? "Get Code via Telegram" : "Loading..."}
                </button>
                <button onClick={() => setStep("code")} className="w-full mt-2 py-2 text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
                  Already have a code? Enter it →
                </button>
                <button onClick={onClose} className="w-full py-2 text-zinc-700 hover:text-zinc-500 text-sm transition-colors">Cancel</button>
              </motion.div>
            ) : (
              <motion.div key="code" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}>
                <h2 className="text-white text-xl font-bold text-center mb-1">Enter Your Code</h2>
                <p className="text-zinc-400 text-sm text-center mb-6">Enter the 6-digit code sent by the Telegram bot.</p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  className="w-full text-center text-3xl font-mono tracking-widest py-4 px-4 rounded-xl border text-white placeholder:text-zinc-700 focus:outline-none transition-colors mb-3"
                  style={{ background: "rgba(255,255,255,0.06)", borderColor: status === "invalid_code" ? "#ef4444" : "rgba(255,255,255,0.10)" }}
                  autoFocus
                />
                <AnimatePresence>
                  {status === "invalid_code" && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-400 text-xs text-center mb-3">
                      ❌ Code is incorrect or expired. Get a new code below.
                    </motion.p>
                  )}
                  {status === "session_error" && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-yellow-400 text-xs text-center mb-3">
                      ⚠️ Session expired. Please get a new code.
                    </motion.p>
                  )}
                  {status === "error" && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-400 text-xs text-center mb-3">
                      ⚠️ Network error. Please try again.
                    </motion.p>
                  )}
                </AnimatePresence>
                <button
                  onClick={handleVerify}
                  disabled={code.length < 6 || status === "loading" || status === "session_error"}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}
                >
                  {status === "loading" ? (
                    <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Verifying...</>
                  ) : "Get Access ✓"}
                </button>
                <button onClick={handleNewSession} className="w-full mt-2 py-2 text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
                  ← Go back / Get new code
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {step === "join" && (
            <p className="text-center text-zinc-700 text-xs mt-4">
              Only channel membership is verified • No personal data stored
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AppLauncher() {
  const [, navigate] = useLocation();
  const { isDark } = useTheme();
  const [ssGate, setSSGate] = useState(false);
  const [ssAuthed, setSSAuthed] = useState<SSStoredAuth | null>(null);

  useEffect(() => {
    setSSAuthed(getSSAuth());
  }, []);

  const handleVibrant = () => {
    if (ssAuthed) {
      window.open("https://vb-studysquad.pages.dev/", "_blank");
    } else {
      setSSGate(true);
    }
  };

  const handleSSSuccess = (user: { id: string; name: string }) => {
    setSSGate(false);
    setSSAuthed({ user, expires: Date.now() + EXPIRY_MS });
    window.open("https://vb-studysquad.pages.dev/", "_blank");
  };

  const bg = isDark ? "#0a0a0f" : "#f1f0f7";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12"
      style={{ background: bg }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex flex-col items-center mb-8 sm:mb-10"
      >
        <div
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-xl mb-3"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
        >
          <span className="text-white font-black text-xl tracking-tight">PW</span>
        </div>
        <h1 className="text-white font-black text-2xl sm:text-3xl tracking-tight mb-1">PWX Hub</h1>
        <p className="text-zinc-500 text-sm sm:text-base">Choose an App</p>
      </motion.div>

      {/* 2-column grid */}
      <div className="w-full max-w-sm sm:max-w-md grid grid-cols-2 gap-3 sm:gap-4">

        {/* PWX tile */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
          onClick={() => navigate("/pw")}
          className="flex flex-col items-center justify-between rounded-2xl p-4 sm:p-5 text-left transition-transform duration-200 active:scale-95 hover:scale-[1.03] focus:outline-none"
          style={{
            background: "linear-gradient(145deg,#1a1a2e,#16213e)",
            border: "1px solid rgba(99,102,241,0.25)",
            boxShadow: "0 4px 24px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
            minHeight: 160,
          }}
        >
          {/* Icon */}
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg mb-3 self-center"
            style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
          >
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          {/* Name */}
          <div className="w-full">
            <p className="text-white font-bold text-base leading-tight">PWX</p>
            <p className="text-indigo-400 text-xs mt-0.5 font-medium">Free Batches</p>
            <div className="flex items-center gap-1 mt-2">
              <TgIcon className="w-3 h-3 text-[#0088cc]" />
              <span className="text-zinc-500 text-[11px]">@pwxonrender</span>
            </div>
          </div>
        </motion.button>

        {/* Vibrant Academy tile */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.18, ease: "easeOut" }}
          onClick={handleVibrant}
          className="flex flex-col items-center justify-between rounded-2xl p-4 sm:p-5 text-left transition-transform duration-200 active:scale-95 hover:scale-[1.03] focus:outline-none relative"
          style={{
            background: "linear-gradient(145deg,#1a0a2e,#1e0a38)",
            border: "1px solid rgba(124,58,237,0.25)",
            boxShadow: "0 4px 24px rgba(124,58,237,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
            minHeight: 160,
          }}
        >
          {ssAuthed && (
            <span
              className="absolute top-3 right-3 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}
            >
              ✓
            </span>
          )}
          {/* Icon */}
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg mb-3 self-center"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
          >
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </div>
          {/* Name */}
          <div className="w-full">
            <p className="text-white font-bold text-base leading-tight">Vibrant</p>
            <p className="text-violet-400 text-xs mt-0.5 font-medium">Academy</p>
            <div className="flex items-center gap-1 mt-2">
              <TgIcon className="w-3 h-3 text-[#0088cc]" />
              <span className="text-zinc-500 text-[11px]">@studysquadpro</span>
            </div>
          </div>
        </motion.button>

      </div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="mt-6 sm:mt-8 text-zinc-700 text-xs text-center px-4"
      >
        Only channel membership is verified • No personal data is stored
      </motion.p>

      {/* StudySquad gate modal */}
      <AnimatePresence>
        {ssGate && (
          <StudySquadGate
            onClose={() => setSSGate(false)}
            onSuccess={handleSSSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
