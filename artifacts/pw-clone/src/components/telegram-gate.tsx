import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";

const STORAGE_KEY = "pwx_tg_auth";
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const BOT_USERNAME =
  import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? "pwxsubscribebot";
const CHANNEL_URL = "https://t.me/pwxonrender";

interface TgUser {
  id: string;
  name: string;
  username: string | null;
  photo: string | null;
}

interface StoredAuth {
  user: TgUser;
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

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "not_member" }
  | { kind: "bot_error"; detail?: string }
  | { kind: "error" };

export function TelegramGate({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(getStoredAuth);
  const [state, setState] = useState<State>({ kind: "idle" });
  const widgetRef = useRef<HTMLDivElement>(null);
  const scriptInjected = useRef(false);

  const handleTelegramData = useCallback(
    async (data: Record<string, string>) => {
      setState({ kind: "loading" });
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = (await res.json()) as {
          ok: boolean;
          reason?: string;
          user?: TgUser;
          detail?: string;
        };

        if (json.ok && json.user) {
          const stored: StoredAuth = {
            user: json.user,
            expires: Date.now() + EXPIRY_MS,
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
          setAuth(stored);
          setState({ kind: "idle" });
        } else if (json.reason === "not_member") {
          setState({ kind: "not_member" });
        } else if (json.reason === "bot_error") {
          setState({ kind: "bot_error", detail: json.detail });
        } else {
          setState({ kind: "error" });
        }
      } catch {
        setState({ kind: "error" });
      }
    },
    [],
  );

  // Inject Telegram Login Widget script once
  useEffect(() => {
    if (auth || scriptInjected.current) return;
    scriptInjected.current = true;

    // Register global callback
    (window as Record<string, unknown>)["onTgAuth"] = (
      data: Record<string, string>,
    ) => handleTelegramData(data);

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "10");
    script.setAttribute("data-onauth", "onTgAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;

    if (widgetRef.current) {
      widgetRef.current.appendChild(script);
    }

    return () => {
      delete (window as Record<string, unknown>)["onTgAuth"];
    };
  }, [auth, handleTelegramData]);

  // Already verified — render the app
  if (auth) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="text-center max-w-md w-full"
      >
        {/* Logo / Icon */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex justify-center mb-8"
        >
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#0088cc] to-[#005fa3] flex items-center justify-center shadow-2xl shadow-blue-900/40">
              {/* Telegram paper-plane icon */}
              <svg
                viewBox="0 0 24 24"
                className="w-12 h-12 text-white fill-current"
              >
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </div>
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="absolute -inset-1 rounded-3xl bg-blue-500/20 -z-10"
            />
          </div>
        </motion.div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-white mb-2">
          PWX पर आपका स्वागत है
        </h1>
        <p className="text-zinc-400 text-base leading-relaxed mb-2">
          इस website को access करने के लिए पहले हमारे{" "}
          <a
            href={CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
          >
            Telegram Channel
          </a>{" "}
          को join करें और फिर Telegram से login करें।
        </p>

        {/* Channel join button */}
        <a
          href={CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-2 mb-6 px-5 py-2.5 rounded-xl bg-[#0088cc]/15 border border-[#0088cc]/30 text-blue-400 hover:bg-[#0088cc]/25 hover:text-blue-300 transition-all text-sm font-medium"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current flex-shrink-0">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
          @pwxonrender join करें
        </a>

        {/* State messages */}
        {state.kind === "not_member" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 px-4 py-3 rounded-xl bg-red-900/25 border border-red-700/40 text-red-400 text-sm"
          >
            ❌ आप अभी channel के member नहीं हैं।{" "}
            <a
              href={CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold"
            >
              पहले join करें
            </a>
            , फिर नीचे से login करें।
          </motion.div>
        )}

        {state.kind === "bot_error" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 px-4 py-3 rounded-xl bg-yellow-900/25 border border-yellow-700/40 text-yellow-400 text-sm"
          >
            ⚠️ Bot को channel में add नहीं किया गया। Admin से contact करें।
          </motion.div>
        )}

        {state.kind === "error" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 px-4 py-3 rounded-xl bg-red-900/25 border border-red-700/40 text-red-400 text-sm"
          >
            ⚠️ कुछ error आई। दोबारा try करें।
          </motion.div>
        )}

        {/* Telegram Login Widget container */}
        <div className="flex flex-col items-center gap-3">
          {state.kind === "loading" ? (
            <div className="flex items-center gap-2 text-zinc-400 text-sm">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"
              />
              Verifying membership...
            </div>
          ) : (
            <div
              ref={widgetRef}
              className="flex justify-center [&_iframe]:rounded-xl"
            />
          )}

          <p className="text-zinc-600 text-xs mt-1">
            Login करने के बाद हम सिर्फ आपकी channel membership check करते हैं।
          </p>
        </div>
      </motion.div>
    </div>
  );
}
