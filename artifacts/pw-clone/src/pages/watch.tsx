import { useEffect, useState } from "react";
import { DrmPlayer } from "@/components/DrmPlayer";
import { useAttachmentUrls } from "@/hooks/usePWApi";

export default function Watch() {
  const [params, setParams] = useState({
    batchId: "",
    subjectId: "",
    videoId: "",
  });

  useEffect(() => {
    // Parse URL params
    const searchParams = new URLSearchParams(window.location.search);
    setParams({
      batchId: searchParams.get("batchId") || "",
      subjectId: searchParams.get("subjectId") || "",
      videoId: searchParams.get("videoId") || searchParams.get("childId") || "",
    });
  }, []);

  const { data: attachments } = useAttachmentUrls(
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

  const handleOpenSlides = () => {
    if (attachments && attachments.length > 0 && attachments[0].url) {
      window.open(attachments[0].url, '_blank');
    } else {
      alert("No slides available for this video.");
    }
  };

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative">
      <DrmPlayer
        batchId={params.batchId}
        subjectId={params.subjectId}
        childId={params.videoId}
        title="Video Player"
        onOpenSlides={handleOpenSlides}
      />
    </div>
  );
}
