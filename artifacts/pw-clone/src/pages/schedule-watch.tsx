import { useEffect, useState } from "react";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { ArrowLeft, PlaySquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";

const PLAYER_BASE = "https://learnbyakp.online/study-v2/player";

export default function ScheduleWatch() {
  const [params, setParams] = useState({
    batchId: "", subjectId: "", scheduleId: "",
    title: "", thumbnail: "",
  });
  const [historyAdded, setHistoryAdded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { addToHistory } = useWatchHistory();
  const { isDark } = useTheme();

  // Auto-dismiss loader after 10 s — cross-origin iframes may skip onLoad
  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => setLoaded(true), 10000);
    return () => clearTimeout(t);
  }, [loaded]);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const p = {
      batchId: sp.get("batchId") || "",
      subjectId: sp.get("subjectId") || "",
      scheduleId: sp.get("scheduleId") || "",
      title: sp.get("title") || sp.get("topic") || "Lecture Video",
      thumbnail: sp.get("thumbnail") || "",
    };
    setParams(p);

    if (p.batchId && p.scheduleId && !historyAdded) {
      addToHistory({
        scheduleId: p.scheduleId,
        batchId: p.batchId,
        subjectId: p.subjectId,
        title: p.title,
        thumbnail: p.thumbnail || undefined,
        watchedAt: Date.now(),
      });
      setHistoryAdded(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasParams = !!(params.batchId && params.scheduleId);

  const playerUrl = hasParams
    ? `${PLAYER_BASE}?batch_id=${encodeURIComponent(params.batchId)}&subject_id=${encodeURIComponent(params.subjectId)}&video_id=${encodeURIComponent(params.scheduleId)}&schedule_id=${encodeURIComponent(params.scheduleId)}&title=${encodeURIComponent(params.title)}`
    : "";

  const bg        = isDark ? "radial-gradient(ellipse at center, #0d1117 0%, #060a10 100%)" : "radial-gradient(ellipse at center, #eef2ff 0%, #f8faff 100%)";
  const ringColor = isDark ? "rgba(99,102,241,0.30)" : "rgba(59,130,246,0.20)";
  const arcA      = isDark ? "#818cf8" : "#3b82f6";
  const arcB      = isDark ? "#c4b5fd" : "#6366f1";
  const btnBg     = isDark ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "linear-gradient(135deg, #3b82f6, #6366f1)";
  const btnShadow = isDark ? "0 0 28px rgba(99,102,241,0.5)" : "0 0 28px rgba(59,130,246,0.35)";
  const logoColor = isDark ? "#fff" : "#1e293b";
  const logoAccent= isDark ? "#818cf8" : "#3b82f6";
  const subColor  = isDark ? "rgba(255,255,255,0.35)" : "rgba(30,41,59,0.45)";
  const barBg     = isDark ? "rgba(255,255,255,0.08)" : "rgba(59,130,246,0.10)";
  const barFg     = isDark
    ? "linear-gradient(90deg, transparent, #818cf8, transparent)"
    : "linear-gradient(90deg, transparent, #3b82f6, transparent)";

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      {/* Minimal back button */}
      <button
        onClick={() => window.history.back()}
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "50%",
          color: "#fff",
          cursor: "pointer",
          backdropFilter: "blur(6px)",
          flexShrink: 0,
        }}
        title="Back"
      >
        <ArrowLeft size={16} />
      </button>

      {/* Loading overlay */}
      <AnimatePresence>
        {hasParams && !loaded && (
          <motion.div
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            style={{
              position: "absolute", inset: 0, zIndex: 5,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 32, background: bg, overflow: "hidden",
            }}
          >
            {[200, 320, 440].map((size, i) => (
              <motion.div
                key={size}
                animate={{ scale: [1, 1.08, 1], opacity: [0.06, 0.14, 0.06] }}
                transition={{ duration: 3 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.8 }}
                style={{
                  position: "absolute",
                  width: `min(${size}px, 85vw)`, height: `min(${size}px, 85vw)`,
                  borderRadius: "50%", border: `1px solid ${ringColor}`, pointerEvents: "none",
                }}
              />
            ))}
            <div style={{ position: "relative", width: 90, height: 90 }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  border: "2.5px solid transparent", borderTopColor: arcA, borderRightColor: arcA,
                }}
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
                style={{
                  position: "absolute", inset: 6, borderRadius: "50%",
                  border: "2px solid transparent", borderBottomColor: arcB, borderLeftColor: arcB,
                }}
              />
              <motion.div
                animate={{ scale: [0.92, 1.04, 0.92] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: btnBg, boxShadow: btnShadow,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{
                    width: 0, height: 0,
                    borderTop: "9px solid transparent", borderBottom: "9px solid transparent",
                    borderLeft: "16px solid #fff", marginLeft: 3,
                  }} />
                </div>
              </motion.div>
            </div>
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "0.1em", color: logoColor }}>
                PW<span style={{ color: logoAccent }}>X</span>
              </div>
              <div style={{ fontSize: 12, color: subColor, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                Loading Video
              </div>
            </motion.div>
            <div style={{ width: 160, height: 2, background: barBg, borderRadius: 99, overflow: "hidden" }}>
              <motion.div
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                style={{ width: "60%", height: "100%", background: barFg, borderRadius: 99 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {hasParams ? (
        <iframe
          src={playerUrl}
          onLoad={() => setLoaded(true)}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock allow-top-navigation-by-user-activation allow-popups allow-popups-to-escape-sandbox"
          title={params.title}
        />
      ) : (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100%", color: "#fff", textAlign: "center", padding: 16,
        }}>
          <PlaySquare style={{ width: 48, height: 48, marginBottom: 16, opacity: 0.3 }} />
          <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
            Invalid video parameters. Please go back and select a video.
          </p>
          <Button variant="outline" size="sm" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </div>
      )}
    </div>
  );
}
