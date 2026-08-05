import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { LivePlayer } from "@/components/LivePlayer";

export default function LiveWatch() {
  const [, navigate] = useLocation();
  const [params, setParams] = useState<{
    streamUrl: string;
    title: string;
    clearKeys: Record<string, string>;
    backUrl: string;
  } | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const streamUrl = sp.get("streamUrl") || sp.get("url") || "";
    const title     = sp.get("title") || "Live Class";
    const backUrl   = sp.get("backUrl") || "/pw";

    // Optional clearKeys as JSON string: e.g. {"hexKid":"hexKey"}
    let clearKeys: Record<string, string> = {};
    try {
      const raw = sp.get("clearKeys");
      if (raw) clearKeys = JSON.parse(raw);
    } catch {}

    if (streamUrl) {
      setParams({ streamUrl, title, clearKeys, backUrl });
    }
  }, []);

  function handleBack(backUrl: string) {
    if (backUrl.startsWith("http")) {
      window.location.href = backUrl;
    } else {
      navigate(backUrl);
    }
  }

  if (!params) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
          <path
            d="M1.5 8.5a13 13 0 0 1 21 0M5.5 12.5a9 9 0 0 1 13 0M9.5 16.5a5 5 0 0 1 5 0M12 20v.5"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
          No stream URL provided.
          <br />
          <span style={{ fontSize: 12, opacity: 0.6 }}>
            Add <code style={{ background: "rgba(255,255,255,.08)", padding: "1px 5px", borderRadius: 4 }}>?streamUrl=…</code> to the URL.
          </span>
        </div>
        <button
          onClick={() => navigate("/pw")}
          style={{
            marginTop: 8,
            padding: "8px 20px",
            borderRadius: 8,
            background: "#e53935",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <LivePlayer
        streamUrl={params.streamUrl}
        title={params.title}
        clearKeys={params.clearKeys}
        onBack={() => handleBack(params.backUrl)}
      />
    </div>
  );
}
