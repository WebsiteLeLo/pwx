import { useEffect, useState } from "react";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { ArrowLeft, PlaySquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const PLAYER_BASE = "https://learnbyakp.online/study-v2/player";

export default function ScheduleWatch() {
  const [params, setParams] = useState({
    batchId: "", subjectId: "", scheduleId: "",
    title: "", thumbnail: "",
  });
  const [historyAdded, setHistoryAdded] = useState(false);
  const { addToHistory } = useWatchHistory();

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

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      {/* Minimal back button — icon only, small footprint, pointer-events only on itself */}
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

      {hasParams ? (
        <iframe
          src={playerUrl}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
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
