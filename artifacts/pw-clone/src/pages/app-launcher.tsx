import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";

// ── localStorage helpers ─────────────────────────────────────────────────────
const SS_AUTH_KEY = "ss_tg_auth";
const EXPIRY_MS   = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSSAuth(): boolean {
  try {
    const raw = localStorage.getItem(SS_AUTH_KEY);
    if (!raw) return false;
    const { expires } = JSON.parse(raw);
    if (Date.now() > expires) { localStorage.removeItem(SS_AUTH_KEY); return false; }
    return true;
  } catch { return false; }
}

function setSSAuth() {
  localStorage.setItem(SS_AUTH_KEY, JSON.stringify({ expires: Date.now() + EXPIRY_MS }));
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
function StudySquadGate({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [joined, setJoined] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
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
        {/* Top accent bar */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#7c3aed,#a855f7,#7c3aed)" }} />

        <div className="p-7">
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}>
              <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
          </div>

          {/* Text */}
          <h2 className="text-white text-xl font-bold text-center mb-1">Vibracnt Academy</h2>
          <p className="text-zinc-400 text-sm text-center mb-6 leading-relaxed">
            Access करने के लिए{" "}
            <a href="https://t.me/studysquadpro" target="_blank" rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 font-medium">
              @studysquadpro
            </a>{" "}
            Telegram channel join करना ज़रूरी है।
          </p>

          {/* Steps */}
          <div className="space-y-2 mb-6">
            <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white mt-0.5"
                style={{ background: "#7c3aed" }}>1</span>
              <div>
                <p className="text-white text-sm font-medium">Channel Join करें</p>
                <a href="https://t.me/studysquadpro" target="_blank" rel="noopener noreferrer"
                  className="text-violet-400 text-xs hover:underline"
                  onClick={() => setJoined(true)}>
                  t.me/studysquadpro →
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white mt-0.5"
                style={{ background: "#7c3aed" }}>2</span>
              <div>
                <p className="text-white text-sm font-medium">Continue दबाएं</p>
                <p className="text-zinc-500 text-xs">Join के बाद Vibracnt Academy open होगी</p>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-2">
            <a
              href="https://t.me/studysquadpro"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setJoined(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}
            >
              <TgIcon className="w-4 h-4" />
              Join @studysquadpro
            </a>
            <button
              onClick={() => { setSSAuth(); onSuccess(); }}
              disabled={!joined}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: joined ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.04)",
                color: joined ? "#a78bfa" : "#4b5563",
                border: `1px solid ${joined ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.06)"}`,
                cursor: joined ? "pointer" : "not-allowed",
              }}
            >
              ✓ Join हो गया, Continue करें
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-zinc-600 hover:text-zinc-400 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── App Card ─────────────────────────────────────────────────────────────────
interface AppCardProps {
  name: string;
  tagline: string;
  description: string;
  channel: string;
  channelUrl: string;
  accentFrom: string;
  accentTo: string;
  badgeColor: string;
  icon: React.ReactNode;
  alreadyAuthed: boolean;
  onClick: () => void;
  index: number;
}

function AppCard({
  name, tagline, description, channel, channelUrl,
  accentFrom, accentTo, badgeColor, icon, alreadyAuthed, onClick, index,
}: AppCardProps) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 + index * 0.1, ease: "easeOut" }}
      onClick={onClick}
      className="w-full text-left rounded-2xl overflow-hidden transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      style={{
        background: "#13131a",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
      }}
    >
      {/* Gradient top bar */}
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${accentFrom}, ${accentTo})` }} />

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
            style={{ background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})` }}
          >
            {icon}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-white font-bold text-lg leading-tight">{name}</h2>
              {alreadyAuthed && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>
                  ✓ Access
                </span>
              )}
            </div>
            <p className="text-xs font-semibold mt-0.5 mb-1.5" style={{ color: badgeColor }}>
              {tagline}
            </p>
            <p className="text-zinc-400 text-xs leading-relaxed line-clamp-2">{description}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TgIcon className="w-3.5 h-3.5" style={{ color: "#0088cc" } as any} />
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0088cc] text-xs hover:text-[#29b6f6] transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {channel}
            </a>
          </div>
          <span
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: `linear-gradient(135deg, ${accentFrom}22, ${accentTo}22)`, color: badgeColor }}
          >
            Open →
          </span>
        </div>
      </div>
    </motion.button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AppLauncher() {
  const [, navigate] = useLocation();
  const { isDark } = useTheme();
  const [ssGate, setSSGate] = useState(false);
  const [ssAuthed, setSSAuthed] = useState(false);

  useEffect(() => {
    setSSAuthed(getSSAuth());
  }, []);

  const handleVibracnt = () => {
    if (ssAuthed) {
      window.open("https://vb-studysquad.pages.dev/", "_blank");
    } else {
      setSSGate(true);
    }
  };

  const handleSSSuccess = () => {
    setSSGate(false);
    setSSAuthed(true);
    window.open("https://vb-studysquad.pages.dev/", "_blank");
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start px-4 py-10"
      style={{ background: isDark ? "#0a0a0f" : "#f1f0f7" }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="text-center mb-10 max-w-xs"
      >
        {/* Logo mark */}
        <div className="flex justify-center mb-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
          >
            <span className="text-white font-black text-2xl tracking-tight">PW</span>
          </div>
        </div>
        <h1 className="text-white font-black text-2xl mb-1.5 tracking-tight">PWX Hub</h1>
        <p className="text-zinc-500 text-sm leading-relaxed">
          Apni favourite educational app choose karo
        </p>
      </motion.div>

      {/* App cards */}
      <div className="w-full max-w-sm flex flex-col gap-4">
        {/* PWX — Physics Wallah */}
        <AppCard
          index={0}
          name="PWX"
          tagline="Physics Wallah Free Batches"
          description="IIT JEE, NEET, Foundation — 12,000+ free batches, DPP quizzes, video lectures & study materials."
          channel="@pwxonrender"
          channelUrl="https://t.me/pwxonrender"
          accentFrom="#3b82f6"
          accentTo="#6366f1"
          badgeColor="#818cf8"
          alreadyAuthed={false}
          icon={
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          }
          onClick={() => navigate("/pw")}
        />

        {/* Vibracnt Academy */}
        <AppCard
          index={1}
          name="Vibracnt Academy"
          tagline="Study Squad Pro"
          description="Vibracnt Academy ka complete learning platform — video lectures, notes, live classes & more."
          channel="@studysquadpro"
          channelUrl="https://t.me/studysquadpro"
          accentFrom="#7c3aed"
          accentTo="#a855f7"
          badgeColor="#c084fc"
          alreadyAuthed={ssAuthed}
          icon={
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          }
          onClick={handleVibracnt}
        />
      </div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-10 text-zinc-700 text-xs text-center"
      >
        Channel membership verify होती है • कोई personal data store नहीं होता
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
