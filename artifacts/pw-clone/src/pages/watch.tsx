```tsx
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

const VIDCloudBase = "https://vidcloud.eu.org/play.php";

interface VideoResponse {
  success?: boolean;
  data?: {
    url?: string;
    directUrl?: string;
    streamUrl?: string;
    signedUrl?: string;
    topic?: string;
  };
  url?: string;
  directUrl?: string;
  streamUrl?: string;
  signedUrl?: string;
  topic?: string;
}

function getData(json: VideoResponse) {
  return json.data ?? json;
}

export default function Watch() {
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadVideo() {
      try {
        const sp = new URLSearchParams(window.location.search);

        const batchId =
          sp.get("batchId") ||
          sp.get("batch_id") ||
          "";

        const subjectId =
          sp.get("subjectId") ||
          sp.get("subject_id") ||
          "";

        const topicId =
          sp.get("topicId") ||
          sp.get("topic_id") ||
          "";

        const childId =
          sp.get("childId") ||
          sp.get("videoId") ||
          sp.get("video_id") ||
          sp.get("ContentId") ||
          "";

        const title =
          sp.get("title") ||
          sp.get("video_name") ||
          "";

        const typeId =
          sp.get("typeId") ||
          sp.get("type_id") ||
          "";

        const programId =
          sp.get("programId") ||
          sp.get("program_id") ||
          "";

        const videoImg =
          sp.get("videoImg") ||
          sp.get("video_img") ||
          "";

        if (!batchId || !childId) {
          throw new Error("Missing batchId or videoId.");
        }

        // Same endpoint already used by AkpPlayer
        const response = await fetch(
          `${apiUrl("")}/akp-video-url?batchId=${encodeURIComponent(
            batchId
          )}&childId=${encodeURIComponent(childId)}`
        );

        if (!response.ok) {
          throw new Error(
            `Video information request failed (${response.status})`
          );
        }

        const json: VideoResponse = await response.json();
        const data = getData(json);

        const baseUrl = (
          data.streamUrl ||
          data.url ||
          data.directUrl ||
          ""
        ).split("?")[0];

        if (!baseUrl) {
          throw new Error("No video stream URL returned.");
        }

        const signedQuery = data.signedUrl || "";

        // Same MPD construction used by AkpPlayer
        const mpdUrl = signedQuery
          ? `${baseUrl}${signedQuery}`
          : baseUrl;

        if (cancelled) return;

        /*
         * Build VidCloud URL dynamically.
         * Nothing related to the current lecture is hardcoded.
         */
        const vidcloud = new URL(VIDCloudBase);

        vidcloud.searchParams.set("batch_id", batchId);
        vidcloud.searchParams.set("program_id", programId);
        vidcloud.searchParams.set("subject_id", subjectId);
        vidcloud.searchParams.set("topic_id", topicId);
        vidcloud.searchParams.set("video_id", childId);
        vidcloud.searchParams.set("typeId", typeId);
        vidcloud.searchParams.set("video_url", mpdUrl);

        vidcloud.searchParams.set(
          "video_name",
          data.topic || title || "Lecture"
        );

        vidcloud.searchParams.set("video_img", videoImg);
        vidcloud.searchParams.set("video_type", "new");
        vidcloud.searchParams.set("play_type", "Lecture");

        setVideoUrl(vidcloud.toString());
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load video."
        );
      }
    }

    loadVideo();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
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
          padding: 24,
          textAlign: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Video could not be loaded
          </div>

          <div
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,.55)",
            }}
          >
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!videoUrl) {
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
        referrerPolicy="no-referrer"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          background: "#000",
        }}
      />
    </div>
  );
}
```
