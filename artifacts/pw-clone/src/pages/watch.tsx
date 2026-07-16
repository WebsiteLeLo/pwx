import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function Watch() {
  const [src, setSrc] = useState("");
  const [backUrl, setBackUrl] = useState("/");
  const [, navigate] = useLocation();

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const batchId = sp.get("batchId") || "";
    const subjectId = sp.get("subjectId") || "";

    const p = new URLSearchParams({
      batch_id: batchId,
      subject_id: subjectId,
      video_id: sp.get("videoId") || sp.get("childId") || sp.get("ContentId") || "",
      video_type: "new",
      title: sp.get("title") || "",
    });
    setSrc(`https://vidcloud.eu.org/play.php?${p.toString()}`);

    if (batchId && subjectId) {
      setBackUrl(`/batch/${batchId}/subject/${subjectId}`);
    } else if (batchId) {
      setBackUrl(`/batch/${batchId}`);
    }
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      {/* Our own back button — always visible, routes to our subject page */}
      <button
        onClick={() => navigate(backUrl)}
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
        Back to Subject
      </button>

      {src && (
        <iframe
          src={src}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
          // No allow-top-navigation — iframe cannot redirect our page at all
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock"
          title="Video Player"
        />
      )}
    </div>
  );
}
