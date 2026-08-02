import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "pwx_tg_auth";
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
type Status = "idle" | "loading" | "invalid_code" | "expired" | "error";

export function TelegramGate({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(getStoredAuth);
  const [step, setStep] = useState<Step>("join");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [botLink, setBotLink] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  // Auto-create session so bot link is ready when user clicks
  const createSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { method: "POST" });
      const json = (await res.json()) as { sessionId: string; botLink: string };
      setSessionId(json.sessionId);
      setBotLink(json.botLink);
    } catch {
      // retry silently
    }
  }, []);

  useEffect(() => {
    if (!auth) createSession();
  }, [auth, createSession]);

  const handleGetCode = useCallback(() => {
    if (botLink) window.open(botLink, "_blank");
    setStep("code");
  }, [botLink]);

  const handleVerify = useCallback(async () => {
    if (!sessionId || !code.trim()) return;
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
    await createSession();
  }, [createSession]);

  // Already verified — render app
  if (auth) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        {/* Card */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-8 shadow-2xl">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0088cc] to-[#005fa3] flex items-center justify-center shadow-lg shadow-blue-900/30">
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === "join" ? (
              <motion.div
                key="join"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.25 }}
              >
                <h1 className="text-xl font-bold text-white text-center mb-1">
                  Access Verify करें
                </h1>
                <p className="text-zinc-500 text-sm text-center mb-6 leading-relaxed">
                  Website use करने के लिए{" "}
                  <a
                    href={CHANNEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300"
                  >
                    @pwxonrender
                  </a>{" "}
                  channel join करना ज़रूरी है।
                </p>

                {/* Step 1 */}
                <div className="flex items-start gap-3 mb-4 p-3 rounded-xl bg-white/4">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <p className="text-white text-sm font-medium">Channel Join करें</p>
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
                    <p className="text-white text-sm font-medium">Access Code लें</p>
                    <p className="text-zinc-500 text-xs">
                      नीचे button दबाओ → Telegram bot खुलेगा → code मिलेगा
                    </p>
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
                  {botLink ? "Telegram से Code लें" : "Loading..."}
                </button>

                <button
                  onClick={() => setStep("code")}
                  className="w-full mt-2 py-2 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                >
                  Already code मिल गया? Enter करें →
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="code"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
              >
                <h1 className="text-xl font-bold text-white text-center mb-1">
                  Code Enter करें
                </h1>
                <p className="text-zinc-500 text-sm text-center mb-6">
                  Telegram bot से मिला 6-digit code यहाँ enter करें।
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
                      ❌ Code गलत है या expire हो गया। फिर से try करें।
                    </motion.p>
                  )}
                  {status === "error" && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-red-400 text-xs text-center mb-3"
                    >
                      ⚠️ Network error। दोबारा try करें।
                    </motion.p>
                  )}
                </AnimatePresence>

                <button
                  onClick={handleVerify}
                  disabled={code.length < 6 || status === "loading"}
                  className="w-full py-3 rounded-xl bg-[#0088cc] hover:bg-[#0099dd] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {status === "loading" ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Verifying...
                    </>
                  ) : (
                    "Access करें ✓"
                  )}
                </button>

                <button
                  onClick={handleNewSession}
                  className="w-full mt-2 py-2 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                >
                  ← वापस जाएं / नया code लें
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-zinc-700 text-xs mt-4">
          सिर्फ channel membership verify होती है • कोई personal data store नहीं होता
        </p>
      </motion.div>
    </div>
  );
}
