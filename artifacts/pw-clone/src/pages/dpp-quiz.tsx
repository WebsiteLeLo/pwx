import { useCallback, useEffect, useRef, useState } from "react";

const ACCENT = "#5a4bda";

export default function DppQuiz() {
  const [params, setParams] = useState({
    batchId: "", scheduleId: "", testId: "", tag: "", isFreeTest: "false", title: "",
  });
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [barVisible, setBarVisible] = useState(true);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setParams({
      batchId:    sp.get("batchId")    || "",
      scheduleId: sp.get("scheduleId") || "",
      testId:     sp.get("testId")     || "",
      tag:        sp.get("tag")        || "Start",
      isFreeTest: sp.get("isFreeTest") || "false",
      title:      sp.get("title")      || "DPP Quiz",
    });
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

  const hasParams = !!(params.batchId && params.scheduleId && params.testId);

  const quizUrl = hasParams
    ? `https://rarestudy.in/get-dpp-quiz?batchId=${encodeURIComponent(params.batchId)}&scheduleId=${encodeURIComponent(params.scheduleId)}&testId=${encodeURIComponent(params.testId)}&tag=${encodeURIComponent(params.tag)}&isFreeTest=${encodeURIComponent(params.isFreeTest)}`
    : "";

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-[#0a0a0f] flex flex-col"
      onMouseMove={resetHideTimer}
    >
      <div className="flex-1 relative overflow-hidden">

        {!hasParams && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm text-center" style={{ color: "#7070a0" }}>
              Invalid quiz parameters. Please go back and select a DPP.
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

        {hasParams && (
          <>
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 pointer-events-none transition-opacity duration-500"
              style={{ opacity: iframeLoaded ? 0 : 1 }}
            >
              <div className="relative flex items-center justify-center">
                <span
                  className="absolute w-20 h-20 rounded-full animate-ping"
                  style={{ background: `${ACCENT}22` }}
                />
                <span
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: `${ACCENT}18`, border: `2px solid ${ACCENT}55` }}
                >
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </span>
              </div>
              <div className="flex items-end gap-1" style={{ height: "22px" }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="w-1 rounded-full"
                    style={{
                      background: ACCENT,
                      height: "100%",
                      animation: `barBounce 1s ease-in-out ${i * 0.12}s infinite`,
                      opacity: 0.8,
                    }}
                  />
                ))}
              </div>
              <p className="text-sm font-medium tracking-wide" style={{ color: "rgba(255,255,255,.4)" }}>
                Loading quiz…
              </p>
            </div>

            <iframe
              key={quizUrl}
              src={quizUrl}
              className="absolute inset-0 w-full h-full border-0"
              style={{ opacity: iframeLoaded ? 1 : 0, transition: "opacity 0.5s ease" }}
              allow="autoplay; encrypted-media"
              referrerPolicy="no-referrer"
              onLoad={() => setIframeLoaded(true)}
            />

            {iframeLoaded && (
              <>
                <div
                  className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 py-3 transition-opacity duration-300"
                  style={{
                    opacity: barVisible ? 1 : 0,
                    background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)",
                  }}
                >
                  <button
                    onClick={() => window.history.back()}
                    className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
                    style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                    title="Go back"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 12H5M12 5l-7 7 7 7" />
                    </svg>
                  </button>
                  <span
                    className="text-sm font-medium text-white truncate flex-1"
                    style={{ textShadow: "0 1px 4px rgba(0,0,0,.8)" }}
                  >
                    {params.title}
                  </span>
                </div>

                <button
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  className="absolute bottom-4 right-4 z-20 w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer"
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
              </>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes barBounce {
          0%, 100% { transform: scaleY(0.3); }
          50%       { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
