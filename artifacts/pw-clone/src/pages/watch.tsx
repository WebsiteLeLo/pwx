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

    // Block any attempt by the iframe to navigate the top-level page away
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    // Intercept top-level navigation using the Navigation API (Chrome 102+)
    const nav = (window as any).navigation;
    let navHandler: ((e: any) => void) | null = null;
    if (nav) {
      navHandler = (e: any) => {
        const dest: string = e.destination?.url || "";
        // If the navigation goes to an external site, cancel it and go back
        if (dest && !dest.startsWith(window.location.origin)) {
          e.preventDefault();
          // Go back to batch page if we have params
          if (batchId && subjectId) {
            navigate(`/batch/${batchId}/subject/${subjectId}`);
          } else {
            navigate("/");
          }
        }
      };
      nav.addEventListener("navigate", navHandler);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (nav && navHandler) nav.removeEventListener("navigate", navHandler);
    };
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
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock"
          title="Video Player"
        />
      )}
    </div>
  );
}
