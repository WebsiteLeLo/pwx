import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function Watch() {
  const [src, setSrc] = useState("");
  const [, navigate] = useLocation();

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const batchId = sp.get("batchId") || "";
    const subjectId = sp.get("subjectId") || "";

    const p = new URLSearchParams({
      batch_id: batchId,
      subject_id: subjectId,
      video_id: sp.get("videoId") || sp.get("childId") || sp.get("ContentId") || "",
      video_type: "new",
      title: sp.get("title") || "",
    });
    setSrc(`https://vidcloud.eu.org/play.php?${p.toString()}`);

    // Intercept any top-level navigation triggered by the iframe.
    // If the destination is external, cancel it and send user to our batch page.
    const nav = (window as any).navigation;
    if (!nav) return;

    const handler = (e: any) => {
      const dest: string = e.destination?.url || "";
      if (!dest || dest.startsWith(window.location.origin)) return; // allow same-origin
      e.preventDefault();
      // Redirect to our own subject page
      if (batchId && subjectId) {
        navigate(`/batch/${batchId}/subject/${subjectId}`);
      } else {
        navigate("/");
      }
    };

    nav.addEventListener("navigate", handler);
    return () => nav.removeEventListener("navigate", handler);
  }, [navigate]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      {src && (
        <iframe
          src={src}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
          // allow-top-navigation-by-user-activation lets user clicks navigate the top frame
          // so our Navigation API handler above can intercept and redirect to our site
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock allow-top-navigation-by-user-activation"
          title="Video Player"
        />
      )}
    </div>
  );
}
