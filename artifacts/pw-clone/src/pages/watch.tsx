import { useEffect, useState } from "react";

export default function Watch() {
  const [videoUrl, setVideoUrl] = useState("");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);

    // Get values dynamically from current URL
    const batchId =
      sp.get("batch_id") ||
      sp.get("batchId") ||
      "";

    const programId =
      sp.get("program_id") ||
      sp.get("programId") ||
      "";

    const subjectId =
      sp.get("subject_id") ||
      sp.get("subjectId") ||
      "";

    const topicId =
      sp.get("topic_id") ||
      sp.get("topicId") ||
      "";

    const videoId =
      sp.get("video_id") ||
      sp.get("videoId") ||
      sp.get("childId") ||
      "";

    const typeId =
      sp.get("typeId") ||
      sp.get("type_id") ||
      "";

    const videoUrlParam =
      sp.get("video_url") ||
      sp.get("videoUrl") ||
      "";

    const videoName =
      sp.get("video_name") ||
      sp.get("videoName") ||
      sp.get("title") ||
      "";

    const videoImg =
      sp.get("video_img") ||
      sp.get("videoImg") ||
      "";

    const videoType =
      sp.get("video_type") ||
      sp.get("videoType") ||
      "new";

    const playType =
      sp.get("play_type") ||
      sp.get("playType") ||
      "Lecture";

    // Build VidCloud URL dynamically
    const vidcloud = new URL(
      "https://vidcloud.eu.org/play.php"
    );

    vidcloud.searchParams.set("batch_id", batchId);
    vidcloud.searchParams.set("program_id", programId);
    vidcloud.searchParams.set("subject_id", subjectId);
    vidcloud.searchParams.set("topic_id", topicId);
    vidcloud.searchParams.set("video_id", videoId);
    vidcloud.searchParams.set("typeId", typeId);
    vidcloud.searchParams.set("video_url", videoUrlParam);
    vidcloud.searchParams.set("video_name", videoName);
    vidcloud.searchParams.set("video_img", videoImg);
    vidcloud.searchParams.set("video_type", videoType);
    vidcloud.searchParams.set("play_type", playType);

    setVideoUrl(vidcloud.toString());
  }, []);

  if (!videoUrl) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
        }}
      >
        Loading video...
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        overflow: "hidden",
      }}
    >
      <iframe
        src={videoUrl}
        title="Video Player"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
        }}
      />
    </div>
  );
}
