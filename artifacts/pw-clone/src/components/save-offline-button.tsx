import { useState, useRef, useCallback } from "react";
import { Download, CheckCircle2, Trash2, Loader2, WifiOff } from "lucide-react";
import { useVideoCache } from "@/hooks/useVideoCache";

interface SaveOfflineButtonProps {
  videoId: string;
  batchId: string;
  subjectId: string;
  title: string;
}

// Circular progress ring
function ProgressRing({ pct }: { pct: number }) {
  const r = 10;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct);
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" className="rotate-[-90deg]">
      {/* track */}
      <circle cx="14" cy="14" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" />
      {/* fill */}
      <circle
        cx="14" cy="14" r={r}
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeDasharray={circ}
        strokeDashoffset={dash}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.2s ease" }}
      />
    </svg>
  );
}

export function SaveOfflineButton({ videoId, batchId, subjectId, title }: SaveOfflineButtonProps) {
  const { getStatus, cacheVideo, removeVideo } = useVideoCache();
  const status = getStatus(videoId);

  const [localStatus, setLocalStatus] = useState<"none" | "caching" | "cached" | "error">(status);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [hoverCached, setHoverCached] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Sync if cache is cleared externally
  const currentStatus = localStatus === "none" && status === "cached" ? "cached"
    : localStatus === "cached" && status === "none" ? "none"
    : localStatus;

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (currentStatus === "caching") {
      // Cancel in-progress download
      abortRef.current?.abort();
      setLocalStatus("none");
      setProgress({ done: 0, total: 0 });
      return;
    }

    if (currentStatus === "cached") {
      await removeVideo(videoId);
      setLocalStatus("none");
      setProgress({ done: 0, total: 0 });
      return;
    }

    // Start caching
    setLocalStatus("caching");
    setProgress({ done: 0, total: 0 });
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const result = await cacheVideo(
      videoId, batchId, subjectId, title,
      (done, total) => setProgress({ done, total }),
      ctrl.signal
    );

    if (!ctrl.signal.aborted) {
      setLocalStatus(result === "ok" ? "cached" : "error");
      if (result !== "ok") setTimeout(() => setLocalStatus("none"), 3000);
    }
  }, [currentStatus, videoId, batchId, subjectId, title, cacheVideo, removeVideo]);

  const pct = progress.total > 0 ? progress.done / progress.total : 0;

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHoverCached(true)}
      onMouseLeave={() => setHoverCached(false)}
      title={
        currentStatus === "caching"
          ? `Saving… ${progress.done}/${progress.total} — tap to cancel`
          : currentStatus === "cached"
          ? "Saved offline — tap to remove"
          : currentStatus === "error"
          ? "Save failed — tap to retry"
          : "Save for offline"
      }
      className={`absolute bottom-2 left-2 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all duration-200
        ${currentStatus === "cached"
          ? hoverCached
            ? "bg-red-500/90"
            : "bg-green-500/90"
          : currentStatus === "caching"
          ? "bg-primary/90"
          : currentStatus === "error"
          ? "bg-destructive/90"
          : "bg-black/60 opacity-0 group-hover:opacity-100"
        }`}
      style={{ backdropFilter: "blur(4px)" }}
    >
      {currentStatus === "caching" ? (
        <ProgressRing pct={pct} />
      ) : currentStatus === "cached" ? (
        hoverCached
          ? <Trash2 className="w-3.5 h-3.5 text-white" />
          : <CheckCircle2 className="w-4 h-4 text-white" />
      ) : currentStatus === "error" ? (
        <WifiOff className="w-3.5 h-3.5 text-white" />
      ) : (
        <Download className="w-3.5 h-3.5 text-white" />
      )}
    </button>
  );
}
