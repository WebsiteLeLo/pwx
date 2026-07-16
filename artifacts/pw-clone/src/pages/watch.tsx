import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function Watch() {
  const [src, setSrc] = useState("");
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

      {src && (
        <iframe
          src={src}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
          // allow-top-navigation-by-user-activation: lets user-click-triggered navigation
          // reach window.top so the Navigation API on the parent can intercept & redirect it.
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock allow-top-navigation-by-user-activation"
          title="Video Player"
        />
      )}
    </div>
  );
}
