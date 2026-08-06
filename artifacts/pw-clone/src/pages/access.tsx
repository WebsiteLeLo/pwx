import { motion } from "framer-motion";
import { generateAndRedirect } from "@/lib/access-key";
import { useState } from "react";

const AROLINKS_URL = "https://arolinks.com/vSDzpK";

const styles = {
  shell: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    background:
      "#0a0a12 radial-gradient(ellipse 60% 50% at 50% 30%, rgba(124,58,237,0.25), transparent 70%), radial-gradient(ellipse 40% 40% at 80% 80%, rgba(34,211,238,0.12), transparent 70%)",
    fontFamily: "'Inter', sans-serif",
    color: "#a1a1c2",
    padding: "1.5rem",
  } as React.CSSProperties,
  card: {
    width: "100%",
    maxWidth: 380,
    border: "1px solid rgba(124,58,237,0.35)",
    background: "linear-gradient(180deg, rgba(30,27,75,0.5), rgba(10,10,18,0.7))",
    borderRadius: 14,
    padding: "2.5rem 2rem",
    textAlign: "center" as const,
    backdropFilter: "blur(6px)",
    position: "relative" as const,
    overflow: "hidden",
  },
  eyebrow: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: "0.7rem",
    letterSpacing: "0.2em",
    textTransform: "uppercase" as const,
    color: "#22d3ee",
    marginBottom: "0.75rem",
  },
  title: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 600,
    fontSize: "1.5rem",
    color: "#f4f4fb",
    marginBottom: "0.5rem",
  },
  copy: {
    fontSize: "0.9rem",
    lineHeight: 1.5,
    color: "#a1a1c2",
    marginBottom: "2rem",
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
      {/* scoped styles for things inline objects can't express: pseudo-elements, keyframes, hover */}
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
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .access-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(240,180,41,0.25);
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
        <div style={styles.eyebrow}>Access Required</div>
        <h2 style={styles.title}>Unlock 24 Hours</h2>
        <p style={styles.copy}>
          Generate a key and complete the steps to unlock the platform for 24 hours.
        </p>
        <button className="access-btn" onClick={handleClick} disabled={redirecting}>
          {redirecting ? "Redirecting…" : "Generate Key"}
        </button>
      </motion.div>
    </div>
  );
}
