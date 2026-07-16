import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Watch() {
  const [src, setSrc] = useState("");
  const [loaded, setLoaded] = useState(false);
  const backUrlRef = useRef("/");
  const [, navigate] = useLocation();

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const batchId  = sp.get("batchId")  || "";
    const subjectId = sp.get("subjectId") || "";
    const topicId  = sp.get("topicId")  || "";

    // Build back URL — prefer topic page
    if (batchId && subjectId && topicId) {
      backUrlRef.current = `/batch/${batchId}/subject/${subjectId}/topic/${topicId}`;
    } else if (batchId && subjectId) {
      backUrlRef.current = `/batch/${batchId}/subject/${subjectId}`;
    } else if (batchId) {
      backUrlRef.current = `/batch/${batchId}`;
    }

    const p = new URLSearchParams({
      batch_id:   batchId,
      subject_id: subjectId,
      video_id:   sp.get("videoId") || sp.get("childId") || sp.get("ContentId") || "",
      video_type: "new",
      title:      sp.get("title") || "",
    });
    setSrc(`https://vidcloud.eu.org/play.php?${p.toString()}`);

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
      {/* Visible back button — always available as a safe fallback */}
      <button
        onClick={() => navigate(backUrlRef.current)}
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(0,0,0,0.6)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 8,
          color: "#fff",
          padding: "6px 12px",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          backdropFilter: "blur(6px)",
        }}
      >
        <ArrowLeft size={15} />
        Back to Chapter
      </button>

      {/* Loading overlay */}
      <AnimatePresence>
        {!loaded && (
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
              background: "radial-gradient(ellipse at center, #0d1117 0%, #000 100%)",
              overflow: "hidden",
            }}
          >
            {/* Ambient glow rings */}
            {[200, 320, 440].map((size, i) => (
              <motion.div
                key={size}
                animate={{ scale: [1, 1.08, 1], opacity: [0.06, 0.12, 0.06] }}
                transition={{ duration: 3 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.8 }}
                style={{
                  position: "absolute",
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  border: "1px solid rgba(99,102,241,0.35)",
                  pointerEvents: "none",
                }}
              />
            ))}

            {/* Play button with rotating border */}
            <div style={{ position: "relative", width: 90, height: 90 }}>
              {/* Outer rotating arc */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "2.5px solid transparent",
                  borderTopColor: "#818cf8",
                  borderRightColor: "#818cf8",
                }}
              />
              {/* Counter-rotating arc */}
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
                style={{
                  position: "absolute",
                  inset: 6,
                  borderRadius: "50%",
                  border: "2px solid transparent",
                  borderBottomColor: "#c4b5fd",
                  borderLeftColor: "#c4b5fd",
                }}
              />
              {/* Centre play icon */}
              <motion.div
                animate={{ scale: [0.92, 1.04, 0.92] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 28px rgba(99,102,241,0.5)",
                }}>
                  {/* Triangle play icon */}
                  <div style={{
                    width: 0,
                    height: 0,
                    borderTop: "9px solid transparent",
                    borderBottom: "9px solid transparent",
                    borderLeft: "16px solid #fff",
                    marginLeft: 3,
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
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "0.1em", color: "#fff" }}>
                PW<span style={{ color: "#818cf8" }}>X</span>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                Loading Video
              </div>
            </motion.div>

            {/* Animated progress bar */}
            <div style={{ width: 160, height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
              <motion.div
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  width: "60%",
                  height: "100%",
                  background: "linear-gradient(90deg, transparent, #818cf8, transparent)",
                  borderRadius: 99,
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {src && (
        <iframe
          src={src}
          onLoad={() => setLoaded(true)}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock allow-top-navigation-by-user-activation"
          title="Video Player"
        />
      )}
    </div>
  );
}
