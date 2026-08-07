import { motion } from "framer-motion";
import { KeyRound, Info, CheckCircle2, Loader2, X } from "lucide-react";
import { generateAndRedirect, storeAccessKey, verifyAccessKey } from "@/lib/access-key";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

const AROLINKS_URL = "https://arolinks.com/vSDzpK";

const styles = {
  shell: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    background:
      "#0a0a12 radial-gradient(ellipse 60% 50% at 50% 30%, rgba(124,58,237,0.28), transparent 70%), radial-gradient(ellipse 45% 40% at 85% 85%, rgba(34,211,238,0.14), transparent 70%)",
    fontFamily: "'Inter', sans-serif",
    color: "#a1a1c2",
    padding: "1.5rem",
  } as React.CSSProperties,
  card: {
    width: "100%",
    maxWidth: 400,
    border: "1px solid rgba(124,58,237,0.35)",
    background: "linear-gradient(180deg, rgba(30,27,75,0.55), rgba(10,10,18,0.75))",
    borderRadius: 16,
    padding: "2.75rem 2.25rem",
    textAlign: "center" as const,
    backdropFilter: "blur(8px)",
    position: "relative" as const,
    overflow: "hidden",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,58,237,0.08)",
  },
  keyBadge: {
    width: 52,
    height: 52,
    margin: "0 auto 1.25rem",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg, rgba(240,180,41,0.15), rgba(124,58,237,0.15))",
    border: "1px solid rgba(240,180,41,0.3)",
  },
  eyebrow: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: "0.7rem",
    letterSpacing: "0.2em",
    textTransform: "uppercase" as const,
    color: "#22d3ee",
    marginBottom: "0.5rem",
  },
  title: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 600,
    fontSize: "1.55rem",
    color: "#f4f4fb",
    marginBottom: "0.5rem",
  },
  copy: {
    fontSize: "0.9rem",
    lineHeight: 1.55,
    color: "#a1a1c2",
    marginBottom: "1.75rem",
  },
  note: {
    display: "flex",
    gap: "0.6rem",
    alignItems: "flex-start",
    textAlign: "left" as const,
    marginTop: "1.5rem",
    padding: "0.9rem 1rem",
    borderRadius: 10,
    background: "rgba(34,211,238,0.06)",
    border: "1px solid rgba(34,211,238,0.2)",
    fontSize: "0.78rem",
    lineHeight: 1.5,
    color: "#8f8fb8",
  },
};

export default function AccessPage() {
  const [redirecting, setRedirecting] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [key, setKey] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const keyInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    setRedirecting(true);
    generateAndRedirect(AROLINKS_URL);
  };

  function openKeyModal() {
    setError("");
    setShowKeyModal(true);
    window.setTimeout(() => keyInputRef.current?.focus(), 80);
  }

  function closeKeyModal() {
    if (!checking) setShowKeyModal(false);
  }

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeKeyModal();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [checking]);

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setChecking(true);
    setError("");
    const valid = await verifyAccessKey(key);
    if (valid) {
      storeAccessKey(key);
      setLocation("/pw");
      return;
    }
    setError("This key is invalid, revoked, or already assigned to another device.");
    setChecking(false);
  }

  return (
    <div style={styles.shell}>
      <style>{`
        @keyframes access-scan {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes access-spin {
          to { transform: rotate(360deg); }
        }
        .access-card::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #22d3ee, #f0b429, transparent);
          background-size: 200% 100%;
          animation: access-scan 3.5s linear infinite;
        }
        .access-card {
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .access-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 24px 70px rgba(0,0,0,0.55), 0 0 0 1px rgba(124,58,237,0.18);
        }
        .access-btn {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 600;
          font-size: 0.9rem;
          letter-spacing: 0.03em;
          color: #0a0a12;
          background: linear-gradient(135deg, #f0b429, #ffd76a);
          border: none;
          border-radius: 8px;
          padding: 0.85rem 1.75rem;
          cursor: pointer;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .access-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(240,180,41,0.3);
        }
        .access-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .access-secondary-btn {
          width: 100%;
          border: 1px solid rgba(124,58,237,0.42);
          border-radius: 8px;
          padding: 0.78rem 1rem;
          color: #c4b5fd;
          background: rgba(124,58,237,0.08);
          font-family: 'Space Grotesk', sans-serif;
          font-size: 0.84rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .access-secondary-btn:hover {
          background: rgba(124,58,237,0.16);
          border-color: rgba(167,139,250,0.65);
        }
        .access-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 20;
          display: grid;
          place-items: center;
          padding: 1.25rem;
          background: rgba(3, 3, 10, 0.78);
          backdrop-filter: blur(8px);
        }
        .access-modal {
          width: min(100%, 410px);
          position: relative;
          border: 1px solid rgba(124,58,237,0.5);
          border-radius: 16px;
          padding: 1.5rem;
          background: linear-gradient(180deg, #211c4d, #10101c);
          box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(34,211,238,0.08);
        }
        .access-modal-input {
          width: 100%;
          box-sizing: border-box;
          border-radius: 9px;
          border: 1px solid rgba(124,58,237,0.5);
          background: rgba(0,0,0,0.3);
          color: #f4f4fb;
          padding: 0.9rem 0.95rem;
          outline: none;
          font-family: monospace;
          font-size: 0.82rem;
          letter-spacing: 0.02em;
        }
        .access-modal-input:focus {
          border-color: #22d3ee;
          box-shadow: 0 0 0 3px rgba(34,211,238,0.12);
        }
      `}</style>

      <motion.div
        className="access-card"
        style={styles.card}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <div style={styles.keyBadge}>
          <KeyRound size={22} color="#f0b429" />
        </div>
        <div style={styles.eyebrow}>Access Required</div>
        <h2 style={styles.title}>Unlock 24 Hours</h2>
        <p style={styles.copy}>
          Generate a key and complete the steps to unlock the platform for 24 hours.
        </p>
        <button className="access-btn" onClick={handleClick} disabled={redirecting}>
          <KeyRound size={16} />
          {redirecting ? "Redirecting…" : "Generate Key"}
        </button>

        <button className="access-secondary-btn" onClick={openKeyModal} type="button">
          <CheckCircle2 size={16} style={{ verticalAlign: "middle", marginRight: 7 }} />
          I already have an access key
        </button>

        <div style={styles.note}>
          <Info size={15} color="#22d3ee" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            Ye key isiliye lagai gayi hai taaki server ka cost nikal sake, copyright
            claims se bacha ja sake, aur platform pe naye features laaye ja sakein.
          </span>
        </div>
      </motion.div>

      {showKeyModal && (
        <motion.div
          className="access-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeKeyModal();
          }}
        >
          <motion.div
            className="access-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-key-modal-title"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              aria-label="Close access key dialog"
              onClick={closeKeyModal}
              disabled={checking}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                display: "grid",
                placeItems: "center",
                width: 32,
                height: 32,
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                color: "#a1a1c2",
                background: "rgba(255,255,255,0.05)",
                cursor: checking ? "not-allowed" : "pointer",
              }}
            >
              <X size={16} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 8 }}>
              <div style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, color: "#22d3ee", background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.2)" }}>
                <KeyRound size={19} />
              </div>
              <div>
                <h3 id="access-key-modal-title" style={{ margin: 0, color: "#f4f4fb", fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.1rem" }}>
                  Enter your access key
                </h3>
                <p style={{ margin: "3px 0 0", color: "#8f8fb8", fontSize: "0.78rem" }}>
                  Paste the key you received from the admin.
                </p>
              </div>
            </div>

            <form onSubmit={handleVerify} style={{ display: "grid", gap: "0.7rem", marginTop: "1.25rem" }}>
              <label htmlFor="access-key-input" style={{ color: "#c4c4df", fontSize: "0.78rem", fontWeight: 600 }}>
                Access key
              </label>
              <input
                ref={keyInputRef}
                id="access-key-input"
                className="access-modal-input"
                value={key}
                onChange={(event) => {
                  setKey(event.target.value.toUpperCase());
                  if (error) setError("");
                }}
                placeholder="PWX-XXXXXX-XXXXXX-XXXXXX"
                autoComplete="off"
                spellCheck={false}
              />
              {error && (
                <p style={{ margin: 0, color: "#f87171", fontSize: "0.78rem", lineHeight: 1.4 }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={checking || !key.trim()}
                className="access-btn"
                style={{ marginTop: 3 }}
              >
                {checking ? <Loader2 size={16} style={{ animation: "access-spin 0.9s linear infinite" }} /> : <CheckCircle2 size={16} />}
                {checking ? "Checking key…" : "Unlock platform"}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
