import { useCallback, useEffect, useRef, useState } from "react";
import { useWatchHistory } from "@/hooks/useWatchHistory";

const ACCENT = "#5a4bda";
const RED = "#ef4444";

function formatTime(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "Starting soon…";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

type ViewState = "loading" | "upcoming" | "live" | "ended" | "invalid";

export default function ScheduleWatch() {
  const [params, setParams] = useState({
    batchId: "", subjectId: "", scheduleId: "",
    status: "", startTime: "", endTime: "", topic: "", subjectName: "",
    title: "", thumbnail: "",
  });
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [barVisible, setBarVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { addToHistory } = useWatchHistory();

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setParams({
      batchId: sp.get("batchId") || "",
      subjectId: sp.get("subjectId") || "",
      scheduleId: sp.get("scheduleId") || "",
      status: sp.get("status") || "",
      startTime: sp.get("startTime") || "",
      endTime: sp.get("endTime") || "",
      topic: sp.get("topic") || "",
      subjectName: sp.get("subjectName") || "",
      title: sp.get("title") || sp.get("topic") || "Lecture Video",
      thumbnail: sp.get("thumbnail") || "",
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const resetHideTimer = useCallback(() => {
    setBarVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setBarVisible(false), 3000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [resetHideTimer]);

  const hasParams = !!(params.batchId && params.scheduleId);

  const startMs = params.startTime ? new Date(params.startTime).getTime() : 0;
  const endMs = params.endTime ? new Date(params.endTime).getTime() : 0;

  function getViewState(): ViewState {
    if (!hasParams) return "invalid";
    if (params.status === "LIVE") return "live";
    if (params.status === "COMPLETED") return "ended";
    if (startMs && endMs) {
      if (now >= startMs && now <= endMs) return "live";
      if (now > endMs) return "ended";
      return "upcoming";
    }
    return "ended";
  }

  const view = getViewState();
  const msUntilStart = startMs ? startMs - now : 0;
  const countdown = formatCountdown(msUntilStart);

  const rarestudyUrl = hasParams
    ? `https://rarestudy.in/schedule-details?batchId=${encodeURIComponent(params.batchId)}&subjectId=${encodeURIComponent(params.subjectId)}&scheduleId=${encodeURIComponent(params.scheduleId)}&tap=video`
    : "";

  function handleIframeLoad() {
    setIframeLoaded(true);
    if (hasParams && params.scheduleId) {
      addToHistory({
        scheduleId: params.scheduleId,
        batchId: params.batchId,
        subjectId: params.subjectId,
        title: params.title || params.topic || "Lecture Video",
        subjectName: params.subjectName || undefined,
        thumbnail: params.thumbnail || undefined,
        watchedAt: Date.now(),
      });
    }
  }

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  return (
    <div ref={containerRef} className="fixed inset-0 bg-[#0a0a0f] flex flex-col" onMouseMove={resetHideTimer}>
      <div className="flex-1 relative overflow-hidden">

        {/* INVALID */}
        {view === "invalid" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="1.5">
              <path d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" />
            </svg>
            <p className="text-sm text-center" style={{ color: "#7070a0" }}>
              Invalid video parameters. Please go back and select a class.
            </p>
            <button
              className="px-5 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: ACCENT }}
              onClick={() => window.history.back()}
            >
              Go Back
            </button>
          </div>
        )}

        {/* Player — shown for all valid states */}
        {view !== "invalid" && (
          <>
            {/* Loading overlay */}
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 pointer-events-none transition-opacity duration-500"
              style={{ opacity: iframeLoaded ? 0 : 1 }}
            >
              <div className="relative flex items-center justify-center">
                <span className="absolute w-20 h-20 rounded-full animate-ping"
                  style={{ background: view === "live" ? `${RED}22` : `${ACCENT}22` }} />
                <span className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: view === "live" ? `${RED}18` : `${ACCENT}18`, border: `2px solid ${view === "live" ? RED : ACCENT}55` }}>
                  {view === "live" ? (
                    <svg viewBox="0 0 24 24" width="22" height="22" fill={RED}>
                      <circle cx="12" cy="12" r="5" />
                      <circle cx="12" cy="12" r="9" fill="none" stroke={RED} strokeWidth="1.5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="26" height="26" fill={ACCENT}>
                      <path d="M6 4.75c0-1.087 1.2-1.7 2.11-1.1l11 7.25a1.3 1.3 0 010 2.2l-11 7.25C7.2 20.95 6 20.337 6 19.25V4.75z"/>
                    </svg>
                  )}
                </span>
              </div>
              <div className="flex items-end gap-1" style={{ height: "22px" }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="w-1 rounded-full"
                    style={{
                      background: view === "live" ? RED : ACCENT,
                      height: "100%",
                      animation: `barBounce 1s ease-in-out ${i * 0.12}s infinite`,
                      opacity: 0.8,
                    }}
                  />
                ))}
              </div>
              <p className="text-sm font-medium tracking-wide" style={{ color: "rgba(255,255,255,.4)" }}>
                {view === "live" ? "Connecting to live stream…" : "Loading…"}
              </p>
            </div>

            <iframe
              key={rarestudyUrl}
              src={rarestudyUrl}
              className="absolute inset-0 w-full h-full border-0"
              style={{ opacity: iframeLoaded ? 1 : 0, transition: "opacity 0.5s ease" }}
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="no-referrer"
              onLoad={handleIframeLoad}
            />

            {/* Fullscreen button — bottom-right, fades on idle */}
            {iframeLoaded && (
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                className="absolute bottom-4 right-4 z-20 w-9 h-9 flex items-center justify-center rounded-lg opacity-100"
                style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
              >
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                  </svg>
                )}
              </button>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes barBounce {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
