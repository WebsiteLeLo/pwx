import { motion } from "framer-motion";
import { KeyRound, Info } from "lucide-react";
import { generateAndRedirect } from "@/lib/access-key";
import { useState } from "react";

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

  const handleClick = () => {
    setRedirecting(true);
    generateAndRedirect(AROLINKS_URL);
  };

  return (
    <div style={styles.shell}>
      <style>{`
        @keyframes access-scan {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
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

        <div style={styles.note}>
          <Info size={15} color="#22d3ee" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            Ye key isiliye lagai gayi hai taaki server ka cost nikal sake, copyright
            claims se bacha ja sake, aur platform pe naye features laaye ja sakein.
          </span>
        </div>
      </motion.div>
    </div>
  );
}
