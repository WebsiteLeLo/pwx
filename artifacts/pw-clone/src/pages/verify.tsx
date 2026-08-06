import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { verifyPendingToken } from "@/lib/access-key";

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
    marginBottom: "1rem",
  },
  ring: (state: "checking" | "success" | "failed"): React.CSSProperties => ({
    width: 56,
    height: 56,
    margin: "0 auto 1.5rem",
    borderRadius: "50%",
    border: "3px solid rgba(124,58,237,0.25)",
    borderTopColor:
      state === "success" ? "#f0b429" : state === "failed" ? "rgba(255,255,255,0.15)" : "#22d3ee",
    borderColor: state === "failed" ? "rgba(255,255,255,0.15)" : undefined,
  }),
  link: {
    background: "none",
    border: "none",
    color: "#22d3ee",
    fontSize: "0.85rem",
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
  },
};

export default function VerifyPage() {
  const [status, setStatus] = useState<"checking" | "success" | "failed">("checking");
  const [, setLocation] = useLocation();

  useEffect(() => {
    const timeout = setTimeout(() => {
      const success = verifyPendingToken();
      setStatus(success ? "success" : "failed");
      if (success) setTimeout(() => setLocation("/pw"), 1800);
    }, 600);
    return () => clearTimeout(timeout);
  }, [setLocation]);

  return (
    <div style={styles.shell}>
      <style>{`
        @keyframes verify-spin { to { transform: rotate(360deg); } }
        .verify-ring.spin { animation: verify-spin 0.9s linear infinite; }
      `}</style>

      <motion.div
        style={styles.card}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <div
          className={status === "checking" ? "verify-ring spin" : "verify-ring"}
          style={styles.ring(status)}
        />
        <AnimatePresence mode="wait">
          {status === "checking" && (
            <motion.div key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 style={styles.title}>Verifying…</h2>
              <p style={styles.copy}>Confirming your key.</p>
            </motion.div>
          )}
          {status === "success" && (
            <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 style={styles.title}>Access Granted</h2>
              <p style={styles.copy}>Unlocked for 24 hours. Redirecting…</p>
            </motion.div>
          )}
          {status === "failed" && (
            <motion.div key="failed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 style={styles.title}>Verification Failed</h2>
              <p style={styles.copy}>Your key expired or wasn't found.</p>
              <button style={styles.link} onClick={() => setLocation("/access")}>
                Generate a new key
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
