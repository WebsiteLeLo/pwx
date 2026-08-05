import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AkpPlayer } from "@/components/AkpPlayer";

export default function Watch() {
  const [params, setParams] = useState<{
    batchId: string;
    childId: string;
    title: string;
  } | null>(null);
  const backUrlRef = useRef("/");
  const [, navigate] = useLocation();

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const batchId   = sp.get("batchId")  || "";
    const subjectId = sp.get("subjectId") || "";
    const topicId   = sp.get("topicId")  || "";
    const childId   = sp.get("childId") || sp.get("videoId") || sp.get("ContentId") || "";
    const title     = sp.get("title") || "";

    // Build back URL
    const backUrl = sp.get("backUrl");
    if (backUrl) {
      backUrlRef.current = backUrl;
    } else if (batchId && subjectId && topicId) {
      backUrlRef.current = `/batch/${batchId}/subject/${subjectId}/topic/${topicId}`;
    } else if (batchId && subjectId) {
      backUrlRef.current = `/batch/${batchId}/subject/${subjectId}`;
    } else if (batchId) {
      backUrlRef.current = `/batch/${batchId}`;
    }

    if (batchId && childId) {
      setParams({ batchId, childId, title });
    }
  }, []);

  // Back-navigation handler for the player header back button
  useEffect(() => {
    const onPopState = () => navigate(backUrlRef.current);
    // The AkpPlayer calls window.history.back() — intercept popstate
    // so we navigate within the SPA instead of leaving
    return () => {};
  }, [navigate]);

  if (!params) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Missing video parameters</div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <AkpPlayer
        batchId={params.batchId}
        childId={params.childId}
        title={params.title}
      />
    </div>
  );
}
