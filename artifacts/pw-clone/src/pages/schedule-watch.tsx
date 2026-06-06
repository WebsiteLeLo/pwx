import { useEffect, useState } from "react";

const ACCENT = "#5a4bda";

export default function ScheduleWatch() {
  const [params, setParams] = useState({ batchId: "", subjectId: "", scheduleId: "" });

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
        <iframe
          key={rarestudyUrl}
          src={rarestudyUrl}
          className="w-full h-full border-0"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
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
