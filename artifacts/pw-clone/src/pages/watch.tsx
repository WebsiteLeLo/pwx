import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";

type PlayerMode = "akp" | "vidcloud";

export default function Watch() {
  const [srcs, setSrcs] = useState({ akp: "", vidcloud: "" });
  const [player, setPlayer] = useState<PlayerMode>("akp");
  const [isLive, setIsLive] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const backUrlRef = useRef("/");
  const [, navigate] = useLocation();
  const { isDark } = useTheme();

  const src = srcs[player];

  // Auto-dismiss loader after 10 s — cross-origin iframes on mobile often skip onLoad
  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => setLoaded(true), 10000);
    return () => clearTimeout(t);
  }, [loaded, player]);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const batchId   = sp.get("batchId")  || "";
    const subjectId = sp.get("subjectId") || "";
    const topicId   = sp.get("topicId")  || "";

    // Build back URL — explicit backUrl wins, then fall back by available params
    const backUrl = sp.get("backUrl");
    if (backUrl) {
      backUrlRef.current = backUrl;
    } else if (batchId && subjectId && topicId) {
      backUrlRef.current = `/batch/${batchId}/subject/${subjectId}/topic/${topicId}`;
    } else if (batchId && subjectId) {
      backUrlRef.current = `/batch/${batchId}/subject/${subjectId}`;
    } else if (batchId) {
      backUrlRef.current = `/batch/${batchId}`;
    }

    const videoId    = sp.get("videoId") || sp.get("childId") || sp.get("ContentId") || "";
    const title      = sp.get("title") || "";
    const videoType  = sp.get("video_type") || "";
    const live       = videoType === "live";

    setIsLive(live);
    if (live) setPlayer("vidcloud");

    const akpParams = new URLSearchParams({
      batch_id: batchId, subject_id: subjectId,
      video_id: videoId, schedule_id: videoId, title,
    });
    const vcParams = live
      ? new URLSearchParams({
          batch_id: batchId, subject_id: subjectId,
          topic_id: topicId, video_id: videoId,
          video_name: title, video_type: "live", play_type: "Lecture",
        })
      : new URLSearchParams({
          batch_id: batchId, subject_id: subjectId,
          video_id: videoId, video_type: "new", title,
        });

    setSrcs({
      akp:      `https://learnbyakp.online/study-v2/player?${akpParams.toString()}`,
      vidcloud: `https://vidcloud.eu.org/play.php?${vcParams.toString()}`,
    });

    // ── Intercept any top-level navigation the iframe fires ──
    // When "Back to Batch" is clicked inside the iframe it tries to navigate
    // window.top. We catch that here and reroute to our topic page.

    // Primary: Navigation API (Chrome 102+)
    const nav = (window as any).navigation;
    let navHandler: ((e: any) => void) | null = null;
    if (nav) {
      navHandler = (e: any) => {
        const dest: string = e.destination?.url || "";
        if (!dest || dest.startsWith(window.location.origin)) return; // same-origin → let pass
        e.preventDefault();
        navigate(backUrlRef.current);
      };
      nav.addEventListener("navigate", navHandler);
    }

    // Fallback: postMessage from iframe (if vidcloud broadcasts one)
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== "https://vidcloud.eu.org") return;
      const d = e.data;
      if (d === "back" || d === "backToBatch" || d?.type === "back" || d?.backToBatch) {
        navigate(backUrlRef.current);
      }
    };
    window.addEventListener("message", onMessage);

    return () => {
      if (nav && navHandler) nav.removeEventListener("navigate", navHandler);
      window.removeEventListener("message", onMessage);
    };
  }, [navigate]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      {/* Back button */}
      <button
        onClick={() => navigate(backUrlRef.current)}
        style={{
          position: "absolute", top: 10, left: 10, zIndex: 20,
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 36, height: 36,
          background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "50%", color: "#fff", cursor: "pointer",
          backdropFilter: "blur(6px)", flexShrink: 0,
        }}
        title="Back to Chapter"
      >
        <ArrowLeft size={16} />
      </button>

      {/* Player switcher */}
      <div style={{
        position: "absolute", top: 10, right: 10, zIndex: 20,
        display: "flex", gap: 4,
        background: "rgba(0,0,0,0.6)", borderRadius: 20,
        padding: "3px 4px", border: "1px solid rgba(255,255,255,0.15)",
        backdropFilter: "blur(6px)",
      }}>
        {(["akp", "vidcloud"] as PlayerMode[]).map((p, i) => (
          <button
            key={p}
            onClick={() => { setPlayer(p); setLoaded(false); }}
            style={{
              padding: "4px 10px", borderRadius: 16, border: "none",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              background: player === p ? "#5a4bda" : "transparent",
              color: player === p ? "#fff" : "rgba(255,255,255,0.55)",
              transition: "all 0.2s",
            }}
          >
            P{i + 1}
          </button>
        ))}
      </div>

      {/* Loading overlay — theme-aware */}
      <AnimatePresence>
        {!loaded && (() => {
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
            <motion.div
              key="loader"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 5,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 32,
                background: bg,
                overflow: "hidden",
              }}
            >
              {/* Ambient glow rings */}
              {[200, 320, 440].map((size, i) => (
                <motion.div
                  key={size}
                  animate={{ scale: [1, 1.08, 1], opacity: [0.06, 0.14, 0.06] }}
                  transition={{ duration: 3 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.8 }}
                  style={{
                    position: "absolute",
                    width: `min(${size}px, 85vw)`,
                    height: `min(${size}px, 85vw)`,
                    borderRadius: "50%",
                    border: `1px solid ${ringColor}`,
                    pointerEvents: "none",
                  }}
                />
              ))}

              {/* Play button with rotating border */}
              <div style={{ position: "relative", width: 90, height: 90 }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                  style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    border: "2.5px solid transparent",
                    borderTopColor: arcA, borderRightColor: arcA,
                  }}
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
                  style={{
                    position: "absolute", inset: 6, borderRadius: "50%",
                    border: "2px solid transparent",
                    borderBottomColor: arcB, borderLeftColor: arcB,
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

              {/* PWX logo text */}
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

              {/* Animated progress bar */}
              <div style={{ width: 160, height: 2, background: barBg, borderRadius: 99, overflow: "hidden" }}>
                <motion.div
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  style={{ width: "60%", height: "100%", background: barFg, borderRadius: 99 }}
                />
              </div>

            </motion.div>
          );
        })()}
      </AnimatePresence>

      {src && (
        <iframe
          key={player}
          src={src}
          onLoad={() => setLoaded(true)}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock allow-top-navigation-by-user-activation allow-popups allow-popups-to-escape-sandbox"
          title="Video Player"
        />
      )}
    </div>
  );
}
