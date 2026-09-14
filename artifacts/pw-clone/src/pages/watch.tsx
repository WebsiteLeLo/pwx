import { useEffect, useState } from "react";
import { DrmPlayer } from "@/components/DrmPlayer";
import { useScheduleDetails, getPdfUrl } from "@/hooks/usePWApi";

export default function Watch() {
  const [params, setParams] = useState({
    batchId: "",
    subjectId: "",
    videoId: "",
  });

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

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative">
      <DrmPlayer
        batchId={params.batchId}
        subjectId={params.subjectId}
        childId={params.videoId}
        title={title}
        attachments={attachments}
      />
    </div>
  );
}
