import { useEffect, useState } from "react";

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
  });
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());

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
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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
    return "live";
  }

  const view = getViewState();
  const msUntilStart = startMs ? startMs - now : 0;
  const countdown = formatCountdown(msUntilStart);

  const rarestudyUrl = hasParams
    ? `https://rarestudy.in/schedule-details?batchId=${encodeURIComponent(params.batchId)}&subjectId=${encodeURIComponent(params.subjectId)}&scheduleId=${encodeURIComponent(params.scheduleId)}&tap=video`
    : "";

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] flex flex-col">
      {/* Top bar */}
      {hasParams && (
        <div className="flex items-center gap-3 px-4 h-12 border-b border-white/10 z-20 flex-shrink-0" style={{ background: "#0d0d14" }}>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-xs font-medium transition-colors"
            style={{ color: "rgba(255,255,255,.45)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,.9)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,.45)")}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>
          <div className="w-px h-4 bg-white/10" />
          {params.subjectName && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: `${ACCENT}22`, color: ACCENT }}>
              {params.subjectName}
            </span>
          )}
          {params.topic && (
            <span className="text-xs text-white/50 truncate max-w-xs">{params.topic}</span>
          )}
          <div className="flex-1" />
          {view === "live" && (
            <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: RED, color: "#fff" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
          )}
          {view === "upcoming" && params.startTime && (
            <span className="text-xs font-medium tabular-nums" style={{ color: "rgba(255,255,255,.5)" }}>
              Starts at {formatTime(params.startTime)}
            </span>
          )}
        </div>
      )}

      {/* Content */}
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
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="no-referrer"
              onLoad={() => setIframeLoaded(true)}
            />
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
