import { useEffect, useState } from "react";

const PW_API_BASE =
  "https://pwsecure.gourav23032009.workers.dev/api/pw/v1";

const VID_CLOUD_BASE =
  "https://vidcloud.eu.org/play.php";

function pick(obj: any, keys: string[]): string {
  for (const key of keys) {
    const value = obj?.[key];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return String(value);
    }
  }

  return "";
}

function findDeep(obj: any, keys: string[]): string {
  if (!obj || typeof obj !== "object") return "";

  const direct = pick(obj, keys);
  if (direct) return direct;

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const found = findDeep(value, keys);
      if (found) return found;
    }
  }

  return "";
}

function assetUrl(value: any): string {
  if (!value) return "";

  if (typeof value === "string") {
    return /^https?:\/\//i.test(value)
      ? value
      : `https://static.pw.live/${value.replace(/^\/+/, "")}`;
  }

  if (typeof value === "object") {
    if (value.baseUrl && value.key) {
      return `${value.baseUrl}${value.key}`;
    }

    if (value.url) {
      return assetUrl(value.url);
    }

    if (value.key) {
      return `https://static.pw.live/${value.key.replace(/^\/+/, "")}`;
    }
  }

  return "";
}

function cleanVideoUrl(url: string): string {
  if (!url) return "";

  /*
   * VidCloud's real URL uses the base master.mpd URL,
   * not the signed query string used by the custom player.
   */
  try {
    const parsed = new URL(url);

    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split("?")[0];
  }
}

export default function Watch() {
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function openVidCloud() {
      try {
        const sp = new URLSearchParams(
          window.location.search
        );

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

        if (!batchId) {
          throw new Error("batchId missing");
        }

        if (!subjectId) {
          throw new Error("subjectId missing");
        }

        if (!childId) {
          throw new Error("videoId/childId missing");
        }

        /*
         * Only metadata/source information.
         * AkpPlayer is NOT used.
         */
        const scheduleId = childId;

        const detailsUrl =
          `${PW_API_BASE}/batches/` +
          `${encodeURIComponent(batchId)}/subject/` +
          `${encodeURIComponent(subjectId)}/schedule/` +
          `${encodeURIComponent(scheduleId)}/schedule-details`;

        const response = await fetch(detailsUrl, {
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(
            `Schedule details failed: ${response.status}`
          );
        }

        const json = await response.json();

        const root =
          json?.data ??
          json;

        /*
         * Find the actual video object dynamically.
         */
        const videoObject =
          root?.video ??
          root?.videoData ??
          root?.videoDetails ??
          root?.content ??
          root;

        /*
         * video ID
         */
        const videoId =
          findDeep(videoObject, [
            "video_id",
            "videoId",
            "childId",
            "contentId",
            "_id",
            "id",
          ]) ||
          childId;

        /*
         * typeId
         */
        const typeId =
          findDeep(videoObject, [
            "typeId",
            "type_id",
            "videoTypeId",
            "video_type_id",
          ]);

        /*
         * Program ID
         */
        const programId =
          findDeep(videoObject, [
            "program_id",
            "programId",
          ]);

        /*
         * Actual master.mpd URL
         */
        let videoUrl =
          findDeep(videoObject, [
            "video_url",
            "videoUrl",
            "videoURL",
            "streamUrl",
            "streamURL",
            "url",
            "directUrl",
            "directURL",
            "mpdUrl",
            "mpdURL",
            "manifestUrl",
            "manifestURL",
          ]);

        /*
         * If nested object was not enough, search
         * the complete schedule response.
         */
        if (!videoUrl) {
          videoUrl = findDeep(root, [
            "video_url",
            "videoUrl",
            "videoURL",
            "streamUrl",
            "streamURL",
            "url",
            "directUrl",
            "directURL",
            "mpdUrl",
            "mpdURL",
            "manifestUrl",
            "manifestURL",
          ]);
        }

        /*
         * Remove CloudFront signing query.
         * Real VidCloud URL uses:
         *
         * https://...cloudfront.net/UUID/master.mpd
         */
        videoUrl = cleanVideoUrl(videoUrl);

        if (!videoUrl) {
          throw new Error(
            "master.mpd URL was not found in schedule details"
          );
        }

        /*
         * Video name
         */
        const videoName =
          findDeep(videoObject, [
            "video_name",
            "videoName",
            "title",
            "name",
            "topic",
          ]) ||
          findDeep(root, [
            "video_name",
            "videoName",
            "title",
            "name",
            "topic",
          ]) ||
          "Lecture";

        /*
         * Video image
         */
        let videoImgValue =
          findDeep(videoObject, [
            "video_img",
            "videoImg",
            "thumbnail",
            "thumbnailUrl",
            "thumbnail_url",
            "image",
            "imageUrl",
            "image_url",
          ]);

        if (!videoImgValue) {
          videoImgValue =
            findDeep(root, [
              "video_img",
              "videoImg",
              "thumbnail",
              "thumbnailUrl",
              "thumbnail_url",
              "image",
              "imageUrl",
              "image_url",
            ]);
        }

        const videoImg =
          assetUrl(videoImgValue);

        /*
         * Build EXACT VidCloud parameter structure.
         */
        const vidcloud =
          new URL(VID_CLOUD_BASE);

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
          videoId
        );

        vidcloud.searchParams.set(
          "typeId",
          typeId
        );

        vidcloud.searchParams.set(
          "video_url",
          videoUrl
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

        const finalUrl =
          vidcloud.toString();

        console.log(
          "VIDCLOUD URL:",
          finalUrl
        );

        if (cancelled) return;

        /*
         * DIRECTLY OPEN VIDCloud.
         *
         * No iframe.
         * No AkpPlayer.
         * No Shaka.
         * No custom video player.
         */
        window.location.replace(
          finalUrl
        );
      } catch (err) {
        if (cancelled) return;

        console.error(
          "VidCloud error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to generate VidCloud URL"
        );
      }
    }

    openVidCloud();

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
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
        }}
      >
        <div>
          <h2
            style={{
              marginBottom: 10,
            }}
          >
            Unable to open video
          </h2>

          <div
            style={{
              color:
                "rgba(255,255,255,.6)",
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
        fontFamily: "Arial, sans-serif",
      }}
    >
      Opening VidCloud...
    </div>
  );
}
