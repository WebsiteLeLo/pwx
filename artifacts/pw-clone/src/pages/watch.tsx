import { useEffect, useState } from "react";
import { DrmPlayer } from "@/components/DrmPlayer";
import { useScheduleDetails, getPdfUrl, useSlides } from "@/hooks/usePWApi";
import { X } from "lucide-react";

export default function Watch() {
  const [params, setParams] = useState({
    batchId: "",
    subjectId: "",
    videoId: "",
  });
  const [showSlides, setShowSlides] = useState(false);

  useEffect(() => {
    // Parse URL params
    const searchParams = new URLSearchParams(window.location.search);
    const vId = searchParams.get("videoId") || searchParams.get("childId") || "";
    
    if (vId) {
      setParams({
        batchId: searchParams.get("batchId") || "",
        subjectId: searchParams.get("subjectId") || "",
        videoId: vId,
      });
    }
  }, []);

  const { data: scheduleData } = useScheduleDetails(
    params.batchId,
    params.subjectId,
    params.videoId
  );

  const { data: slidesData } = useSlides(
    params.batchId,
    params.subjectId,
    params.videoId
  );

  if (!params.videoId) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#000",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "22px",
              fontWeight: 600,
              marginBottom: "8px",
            }}
          >
            Loading...
          </div>
          <div
            style={{
              fontSize: "14px",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Please wait while we prepare your video.
          </div>
        </div>
      </div>
    );
  }

  const schedData = scheduleData?.data;
  const title = schedData?.topic || "Video Player";
  
  const hwList = schedData?.homeworkIds ?? [];
  const attachments = hwList.flatMap(hw => 
    (hw.attachmentIds ?? []).map(att => ({
      name: att.name || hw.topic || "Attachment",
      url: getPdfUrl(att)
    }))
  );

  const slides = slidesData?.data?.slides ?? [];

  return (
    <div className="w-full h-screen bg-black flex overflow-hidden">
      <div className="flex-1 relative h-full min-w-0">
        <DrmPlayer
          batchId={params.batchId}
          subjectId={params.subjectId}
          childId={params.videoId}
          title={title}
          attachments={attachments}
          onOpenSlides={slides.length > 0 ? () => setShowSlides(p => !p) : undefined}
        />
      </div>

      {showSlides && (
        <div className="w-80 h-full bg-zinc-950 border-l border-zinc-800 flex flex-col shrink-0">
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h3 className="text-white font-semibold text-sm">Slides Timeline</h3>
            <button onClick={() => setShowSlides(false)} className="text-zinc-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {slides.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-4">No slides available.</p>
            ) : (
              slides.map((slide: any, idx: number) => {
                const imgUrl = slide.img?.baseUrl + slide.img?.key;
                const ts = Number(slide.timeStamp);
                
                // Format timestamp if valid
                let tsLabel = null;
                if (ts > 0) {
                  const m = Math.floor(ts / 60);
                  const s = Math.floor(ts % 60);
                  const h = Math.floor(m / 60);
                  tsLabel = h > 0 
                    ? `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                }

                return (
                  <div 
                    key={slide._id || idx} 
                    className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 relative group cursor-pointer hover:border-zinc-600 transition-colors"
                    onClick={() => window.open(imgUrl, "_blank")}
                  >
                    <img 
                      src={imgUrl} 
                      alt={`Slide ${idx + 1}`} 
                      className="w-full h-auto object-cover"
                      loading="lazy"
                    />
                    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-white text-[11px] px-2 py-0.5 rounded font-medium">
                      {idx + 1}
                    </div>
                    {tsLabel && (
                      <div className="absolute bottom-2 right-2 bg-violet-600/90 backdrop-blur-md text-white text-[11px] px-2 py-0.5 rounded font-medium shadow-sm">
                        {tsLabel}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
