import { useEffect, useState } from "react";

export default function Watch() {
  const [src, setSrc] = useState("");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const p = new URLSearchParams({
      batch_id: sp.get("batchId") || "",
      subject_id: sp.get("subjectId") || "",
      video_id: sp.get("videoId") || sp.get("childId") || sp.get("ContentId") || "",
      video_type: "new",
      title: sp.get("title") || "",
    });
    setSrc(`https://vidcloud.eu.org/play.php?${p.toString()}`);
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#000" }}>
      {src && (
        <iframe
          src={src}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
          title="Video Player"
        />
      )}
    </div>
  );
}
