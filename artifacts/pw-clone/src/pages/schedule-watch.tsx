import { useEffect, useState } from "react";

const ACCENT = "#5a4bda";

export default function ScheduleWatch() {
  const [params, setParams] = useState({ batchId: "", subjectId: "", scheduleId: "" });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setParams({
      batchId: sp.get("batchId") || "",
      subjectId: sp.get("subjectId") || "",
      scheduleId: sp.get("scheduleId") || "",
    });
  }, []);

  const hasParams = !!(params.batchId && params.scheduleId);

  const rarestudyUrl = hasParams
    ? `https://rarestudy.in/schedule-details?batchId=${encodeURIComponent(params.batchId)}&subjectId=${encodeURIComponent(params.subjectId)}&scheduleId=${encodeURIComponent(params.scheduleId)}&tap=video`
    : "";

  return (
    <div className="fixed inset-0 bg-black">
      {hasParams ? (
        <>
          {/* Loading overlay — fades out once iframe fires onLoad */}
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 pointer-events-none transition-opacity duration-500"
            style={{ opacity: loaded ? 0 : 1 }}
          >
            {/* Pulsing logo mark */}
            <div className="relative flex items-center justify-center">
              {/* Outer ring pulse */}
              <span
                className="absolute w-20 h-20 rounded-full animate-ping"
                style={{ background: `${ACCENT}22` }}
              />
              {/* Inner circle */}
              <span
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: `${ACCENT}18`, border: `2px solid ${ACCENT}55` }}
              >
                {/* Play icon */}
                <svg viewBox="0 0 24 24" width="26" height="26" fill={ACCENT}>
                  <path d="M6 4.75c0-1.087 1.2-1.7 2.11-1.1l11 7.25a1.3 1.3 0 010 2.2l-11 7.25C7.2 20.95 6 20.337 6 19.25V4.75z"/>
                </svg>
              </span>
            </div>

            {/* Animated bar loader */}
            <div className="flex items-end gap-1" style={{ height: "24px" }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="w-1 rounded-full"
                  style={{
                    background: ACCENT,
                    height: "100%",
                    animation: `barBounce 1s ease-in-out ${i * 0.12}s infinite`,
                    opacity: 0.85,
                  }}
                />
              ))}
            </div>

            <p className="text-sm font-medium tracking-wide" style={{ color: "rgba(255,255,255,.45)" }}>
              Loading video…
            </p>
          </div>

          <iframe
            key={rarestudyUrl}
            src={rarestudyUrl}
            className="absolute inset-0 w-full h-full border-0"
            style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.5s ease" }}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
          />

          <style>{`
            @keyframes barBounce {
              0%, 100% { transform: scaleY(0.3); }
              50% { transform: scaleY(1); }
            }
          `}</style>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="1.5">
            <path d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z"/>
          </svg>
          <p className="text-sm text-center" style={{ color: "#7070a0" }}>
            Invalid video parameters. Please go back and select a video.
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
    </div>
  );
}
