import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

const VIDCLOUD_BASE = "https://vidcloud.eu.org/play.php";

interface VideoData {
  url?: string;
  directUrl?: string;
  streamUrl?: string;
  signedUrl?: string;
  topic?: string;
  vid?: string;
}

interface ApiResponse {
  success?: boolean;
  data?: VideoData;
  url?: string;
  directUrl?: string;
  streamUrl?: string;
  signedUrl?: string;
  topic?: string;
  vid?: string;
}

export default function Watch() {
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function openVideo() {
      try {
        const sp = new URLSearchParams(window.location.search);

        /*
         * Current Watch URL:
         *
         * /watch?batchId=...&subjectId=...&topicId=...&childId=...
         */

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

        /*
         * Optional values.
         *
         * If your previous page already sends these, they will
         * automatically be used. Otherwise they remain empty.
         */

        const programId =
          sp.get("programId") ||
          sp.get("program_id") ||
          "";

        const typeId =
          sp.get("typeId") ||
          sp.get("type_id") ||
          "";

        const videoImg =
          sp.get("videoImg") ||
          sp.get("video_img") ||
          "";

        const suppliedTitle =
          sp.get("title") ||
          sp.get("videoName") ||
          sp.get("video_name") ||
          "";

        if (!batchId) {
          throw new Error("batchId is missing.");
        }

        if (!childId) {
          throw new Error("childId/videoId is missing.");
        }

        /*
         * Get the actual stream information.
         *
         * This is the same endpoint your old AkpPlayer uses.
         */
        const endpoint =
          `${apiUrl("")}/akp-video-url` +
          `?batchId=${encodeURIComponent(batchId)}` +
          `&childId=${encodeURIComponent(childId)}`;

        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(
            `Video API failed (${response.status})`
          );
        }

        const json: ApiResponse = await response.json();

        const data: VideoData =
          json?.data ?? json;

        /*
         * Pick whichever URL your API returns.
         */
        const rawStreamUrl =
          data.streamUrl ||
          data.url ||
          data.directUrl ||
          "";

        if (!rawStreamUrl) {
          throw new Error(
            "No stream URL was returned by the video API."
          );
        }

        /*
         * Remove any existing query string from the base URL.
         */
        const baseStreamUrl =
          rawStreamUrl.split("?")[0];

        /*
         * signedUrl contains the CloudFront query string.
         */
        const signedQuery =
          data.signedUrl || "";

        const mpdUrl = signedQuery
          ? `${baseStreamUrl}${signedQuery}`
          : baseStreamUrl;

        /*
         * Video title.
         *
         * Prefer:
         * 1. API topic
         * 2. URL title
         * 3. fallback
         */
        const videoName =
          data.topic ||
          suppliedTitle ||
          "Lecture";

        /*
         * Build the COMPLETE VidCloud URL dynamically.
         */
        const vidcloud = new URL(
          VIDCLOUD_BASE
        );

        vidcloud.searchParams.set(
          "batch_id",
          batchId
        );

        vidcloud.searchParams.set(
          "program_id",
          programId
        );

        vidcloud.searchParams.set(
          "subject_id",
          subjectId
        );

        vidcloud.searchParams.set(
          "topic_id",
          topicId
        );

        vidcloud.searchParams.set(
          "video_id",
          childId
        );

        vidcloud.searchParams.set(
          "typeId",
          typeId
        );

        vidcloud.searchParams.set(
          "video_url",
          mpdUrl
        );

        vidcloud.searchParams.set(
          "video_name",
          videoName
        );

        vidcloud.searchParams.set(
          "video_img",
          videoImg
        );

        vidcloud.searchParams.set(
          "video_type",
          "new"
        );

        vidcloud.searchParams.set(
          "play_type",
          "Lecture"
        );

        if (cancelled) return;

        /*
         * DIRECTLY OPEN VIDCLOUD IN THE BROWSER.
         *
         * No iframe.
         * No AkpPlayer.
         * No custom player.
         */
        window.location.replace(
          vidcloud.toString()
        );
      } catch (err) {
        if (cancelled) return;

        console.error(
          "Watch error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to open video."
        );
      }
    }

    openVideo();

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
          padding: "24px",
          fontFamily:
            "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "600px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "20px",
              fontWeight: 600,
              marginBottom: "10px",
            }}
          >
            Unable to open video
          </div>

          <div
            style={{
              color:
                "rgba(255,255,255,0.6)",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        </div>
      </div>
    );
  }

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
        fontFamily:
          "Arial, sans-serif",
      }}
    >
      Opening video...
    </div>
  );
}
