import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Lang = "hi" | "en";

const t = {
  hi: {
    title: "Access Verify करें",
    subtitle: (ch: string) => <>Website use करने के लिए{" "}<a href={`https://t.me/${ch}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">@{ch}</a>{" "}channel join करना ज़रूरी है।</>,
    step1Title: "Channel Join करें",
    step2Title: "Access Code लें",
    step2Sub: "नीचे button दबाओ → Telegram bot खुलेगा → code मिलेगा",
    getCode: "Telegram से Code लें",
    loading: "Loading...",
    alreadyHave: "Already code मिल गया? Enter करें →",
    codeTitle: "Code Enter करें",
    codeSub: "Telegram bot से मिला 6-digit code यहाँ enter करें।",
    verify: "Access करें ✓",
    verifying: "Verifying...",
    back: "← वापस जाएं / नया code लें",
    errInvalid: "❌ Code गलत है या expire हो गया। नीचे \"नया code लें\" दबाओ।",
    errSession: "⚠️ Session expire हो गई। नीचे \"नया code लें\" दबाओ।",
    errNetwork: "⚠️ Network error। दोबारा try करें।",
    footer: "सिर्फ channel membership verify होती है • कोई personal data store नहीं होता",
  },
  en: {
    title: "Verify Access",
    subtitle: (ch: string) => <>To use this website, you must join the{" "}<a href={`https://t.me/${ch}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">@{ch}</a>{" "}Telegram channel.</>,
    step1Title: "Join the Channel",
    step2Title: "Get Access Code",
    step2Sub: "Press the button below → Telegram bot opens → receive your code",
    getCode: "Get Code via Telegram",
    loading: "Loading...",
    alreadyHave: "Already have a code? Enter it →",
    codeTitle: "Enter Your Code",
    codeSub: "Enter the 6-digit code sent by the Telegram bot.",
    verify: "Get Access ✓",
    verifying: "Verifying...",
    back: "← Go back / Get new code",
    errInvalid: "❌ Code is incorrect or expired. Press \"Get new code\" below.",
    errSession: "⚠️ Session expired. Press \"Get new code\" below.",
    errNetwork: "⚠️ Network error. Please try again.",
    footer: "Only channel membership is verified • No personal data is stored",
  },
};

const STORAGE_KEY = "pwx_tg_auth";
const SESSION_KEY = "pwx_tg_session"; // sessionStorage key for current session
const EXPIRY_MS = 12 * 60 * 60 * 1000; // 12 hours
const CHANNEL_URL = "https://t.me/pwxonrender";

interface StoredAuth {
  user: { id: string; name: string };
  expires: number;
}

function getStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const auth = JSON.parse(raw) as StoredAuth;
    if (Date.now() > auth.expires) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return auth;
  } catch {
    return null;
  }
}

type Step = "join" | "code";
type Status = "idle" | "loading" | "invalid_code" | "session_error" | "error";

function getSavedSession(): { sessionId: string; botLink: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function TelegramGate({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  const [auth, setAuth] = useState<StoredAuth | null>(getStoredAuth);
  const [step, setStep] = useState<Step>("join");
  const [sessionId, setSessionId] = useState<string | null>(
    () => getSavedSession()?.sessionId ?? null,
  );
  const [botLink, setBotLink] = useState<string | null>(
    () => getSavedSession()?.botLink ?? null,
  );
  const [sessionLoading, setSessionLoading] = useState(false);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  // Create (or restore) a session
  const createSession = useCallback(async () => {
    setSessionLoading(true);
    try {
      const res = await fetch("/api/auth/session", { method: "POST" });
      const json = (await res.json()) as { sessionId: string; botLink: string };
      setSessionId(json.sessionId);
      setBotLink(json.botLink);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(json));
    } catch {
      setSessionId(null);
      setBotLink(null);
    } finally {
      setSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth) return;
    // Only create a new session if we don't have one already
    if (!getSavedSession()) createSession();
  }, [auth, createSession]);

  const handleGetCode = useCallback(() => {
    if (botLink) window.open(botLink, "_blank");
    setStep("code");
  }, [botLink]);

  const handleVerify = useCallback(async () => {
    if (!code.trim()) return;
    if (!sessionId) {
      setStatus("session_error");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, code: code.trim() }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        reason?: string;
        user?: { id: string; name: string };
      };

      if (json.ok && json.user) {
        const stored: StoredAuth = {
          user: json.user,
          expires: Date.now() + EXPIRY_MS,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        sessionStorage.removeItem(SESSION_KEY);
        setAuth(stored);
      } else if (json.reason === "invalid_code") {
        setStatus("invalid_code");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }, [sessionId, code]);

  const handleNewSession = useCallback(async () => {
    setCode("");
    setStatus("idle");
    setStep("join");
    sessionStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    setBotLink(null);
    await createSession();
  }, [createSession]);

  // Already verified — render app
  if (auth) return <>{children}</>;

  const tx = t[lang];
  const CHANNEL = "pwxonrender";

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        {/* Card */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-8 shadow-2xl relative">

          {/* Language toggle — top right */}
          <button
            onClick={() => setLang(l => l === "en" ? "hi" : "en")}
            className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/6 hover:bg-white/10 border border-white/8 text-zinc-400 hover:text-white text-xs font-medium transition-all"
          >
            <span className="text-base leading-none">{lang === "en" ? "🇮🇳" : "🇬🇧"}</span>
            {lang === "en" ? "हिन्दी" : "English"}
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-6 mt-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0088cc] to-[#005fa3] flex items-center justify-center shadow-lg shadow-blue-900/30">
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === "join" ? (
              <motion.div
                key={`join-${lang}`}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.25 }}
              >
                <h1 className="text-xl font-bold text-white text-center mb-1">
                  {tx.title}
                </h1>
                <p className="text-zinc-500 text-sm text-center mb-6 leading-relaxed">
                  {tx.subtitle(CHANNEL)}
                </p>

                {/* Step 1 */}
                <div className="flex items-start gap-3 mb-4 p-3 rounded-xl bg-white/4">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <p className="text-white text-sm font-medium">{tx.step1Title}</p>
                    <a
                      href={CHANNEL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 text-xs hover:underline"
                    >
                      t.me/pwxonrender →
                    </a>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 mb-6 p-3 rounded-xl bg-white/4">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <p className="text-white text-sm font-medium">{tx.step2Title}</p>
                    <p className="text-zinc-500 text-xs">{tx.step2Sub}</p>
                  </div>
                </div>

                <button
                  onClick={handleGetCode}
                  disabled={!botLink}
                  className="w-full py-3 rounded-xl bg-[#0088cc] hover:bg-[#0099dd] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white flex-shrink-0">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                  {botLink ? tx.getCode : tx.loading}
                </button>

                <button
                  onClick={() => setStep("code")}
                  className="w-full mt-2 py-2 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                >
                  {tx.alreadyHave}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={`code-${lang}`}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
              >
                <h1 className="text-xl font-bold text-white text-center mb-1">
                  {tx.codeTitle}
                </h1>
                <p className="text-zinc-500 text-sm text-center mb-6">
                  {tx.codeSub}
                </p>

                {/* Code input */}
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  className="w-full text-center text-3xl font-mono tracking-widest py-4 px-4 rounded-xl bg-white/6 border border-white/10 text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-500/60 transition-colors mb-3"
                  autoFocus
                />

                {/* Error messages */}
                <AnimatePresence>
                  {status === "invalid_code" && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-red-400 text-xs text-center mb-3"
                    >
                      {tx.errInvalid}
                    </motion.p>
                  )}
                  {status === "session_error" && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-yellow-400 text-xs text-center mb-3"
                    >
                      {tx.errSession}
                    </motion.p>
                  )}
                  {status === "error" && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-red-400 text-xs text-center mb-3"
                    >
                      {tx.errNetwork}
                    </motion.p>
                  )}
                </AnimatePresence>

                <button
                  onClick={handleVerify}
                  disabled={code.length < 6 || status === "loading" || status === "session_error"}
                  className="w-full py-3 rounded-xl bg-[#0088cc] hover:bg-[#0099dd] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {status === "loading" ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      />
                      {tx.verifying}
                    </>
                  ) : (
                    tx.verify
                  )}
                </button>

                <button
                  onClick={handleNewSession}
                  className="w-full mt-2 py-2 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                >
                  {tx.back}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-zinc-700 text-xs mt-4">
          {tx.footer}
        </p>
      </motion.div>
    </div>
  );
}
