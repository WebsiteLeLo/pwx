import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { LivePlayer } from "@/components/LivePlayer";
import { apiUrl } from "@/lib/apiUrl";

const PROXY_BASE = apiUrl("");

interface ResolvedStream {
  streamUrl: string;
  clearKeys: Record<string, string>;
  title: string;
  backUrl: string;
}

type PageState =
  | { kind: "loading"; title: string; backUrl: string }
  | { kind: "ready"; stream: ResolvedStream }
  | { kind: "error"; message: string; backUrl: string }
  | { kind: "no-url"; backUrl: string };

export default function LiveWatch() {
  const [, navigate] = useLocation();
  const [state, setState] = useState<PageState | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);

    // Params
    const directStreamUrl = sp.get("streamUrl") || sp.get("url") || "";
    const batchId  = sp.get("batchId")  || "";
    const videoId  = sp.get("videoId")  || sp.get("childId") || "";
    const title    = sp.get("title")    || "Live Class";
    const backUrl  = sp.get("backUrl")  || "/pw";

    // Optional inline clearKeys (JSON) — only used with directStreamUrl
    let inlineClearKeys: Record<string, string> = {};
    try {
      const raw = sp.get("clearKeys");
      if (raw) inlineClearKeys = JSON.parse(raw);
    } catch {}

    /* ── Case 1: direct streamUrl passed ─────────────────────────────── */
    if (directStreamUrl) {
      setState({
        kind: "ready",
        stream: { streamUrl: directStreamUrl, clearKeys: inlineClearKeys, title, backUrl },
      });
      return;
    }

    /* ── Case 2: batchId + videoId → fetch from API ───────────────────── */
    if (batchId && videoId) {
      setState({ kind: "loading", title, backUrl });

      let cancelled = false;
      (async () => {
        try {
          const res = await fetch(
            `${PROXY_BASE}/akp-video-url?batchId=${encodeURIComponent(batchId)}&childId=${encodeURIComponent(videoId)}`
          );
          if (!res.ok) throw new Error(`API error ${res.status}`);
          const json = await res.json();

          if (cancelled) return;

          // Normalise — API may return data at root or inside .data
          const d = (json.data ?? json) as any;
          const baseUrl = (d.streamUrl ?? d.url ?? d.directUrl ?? "").split("?")[0];
          if (!baseUrl) throw new Error("No stream URL returned by API");

          const signedQs = d.signedUrl ?? "";
          const streamUrl = signedQs ? `${baseUrl}${signedQs}` : baseUrl;
          const clearKeys: Record<string, string> = d.clearKeys ?? {};
          const resolvedTitle = d.topic || title;

          setState({
            kind: "ready",
            stream: { streamUrl, clearKeys, title: resolvedTitle, backUrl },
          });
        } catch (err: any) {
          if (!cancelled) {
            setState({
              kind: "error",
              message: err?.message || "Failed to load live stream",
              backUrl,
            });
          }
        }
      })();

      return () => { cancelled = true; };
    }

    /* ── Case 3: nothing useful provided ─────────────────────────────── */
    setState({ kind: "no-url", backUrl });
  }, []);

  /* ── Back handler ────────────────────────────────────────────────── */
  function goBack(backUrl: string) {
    if (backUrl.startsWith("http")) window.location.href = backUrl;
    else navigate(backUrl);
  }

  /* ── Loading state (API fetch in progress) ───────────────────────── */
  if (!state || state.kind === "loading") {
    const backUrl = (state as any)?.backUrl ?? "/pw";
    const title   = (state as any)?.title   ?? "Live Class";
    return (
      <div style={{ position: "fixed", inset: 0, background: "#000" }}>
        {/* Re-use LivePlayer's loading UI by passing a dummy non-resolving URL
            — actually render a hand-crafted loader that matches the style */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20,
          background: "radial-gradient(ellipse at center, #0d1117 0%, #060a10 100%)",
        }}>
          {/* Pulsing rings */}
          {[160, 260, 360].map((size, i) => (
            <div key={size} style={{
              position: "absolute",
              width: size, height: size,
              borderRadius: "50%",
              border: "1px solid rgba(229,57,53,0.18)",
              animation: `ping ${2 + i * 0.6}s ease-in-out ${i * 0.4}s infinite`,
            }} />
          ))}
          {/* Spinner */}
          <div style={{ position: "relative", width: 64, height: 64 }}>
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: "3px solid rgba(229,57,53,.12)", borderTopColor: "#e53935",
              animation: "spin 0.8s linear infinite",
            }} />
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: "linear-gradient(135deg, #e53935, #ef9a9a)",
                boxShadow: "0 0 20px rgba(229,57,53,0.5)",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M1.5 8.5a13 13 0 0 1 21 0M5.5 12.5a9 9 0 0 1 13 0M9.5 16.5a5 5 0 0 1 5 0M12 20v.5"
                    stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>
          {/* Text */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: 4, color: "#fff" }}>PW</span>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "2px 10px", borderRadius: 4,
                background: "#e53935", color: "#fff",
                fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", animation: "pulse 1s infinite" }} />
                LIVE
              </span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase" }}>
              Connecting…
            </div>
            {title && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4, maxWidth: 300, textAlign: "center" }}>
                {title}
              </div>
            )}
          </div>
        </div>
        {/* Back button */}
        <button
          onClick={() => goBack(backUrl)}
          style={{
            position: "absolute", top: 8, left: 8, zIndex: 30,
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(0,0,0,0.5)", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
          </svg>
        </button>
      </div>
    );
  }

  /* ── Error state ─────────────────────────────────────────────────── */
  if (state.kind === "error") {
    return (
      <div style={{
        position: "fixed", inset: 0, background: "#000",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
      }}>
        <span style={{ fontSize: 40 }}>📡</span>
        <p style={{ color: "#ff6584", fontSize: 14, maxWidth: 280, textAlign: "center", lineHeight: 1.6 }}>
          {state.message}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "8px 20px", borderRadius: 8, background: "#e53935",
            color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Retry
        </button>
        <button
          onClick={() => goBack(state.backUrl)}
          style={{ marginTop: 4, fontSize: 13, color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer" }}
        >
          ← Go back
        </button>
      </div>
    );
  }

  /* ── No URL provided ─────────────────────────────────────────────── */
  if (state.kind === "no-url") {
    return (
      <div style={{
        position: "fixed", inset: 0, background: "#000",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
      }}>
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
          <path d="M1.5 8.5a13 13 0 0 1 21 0M5.5 12.5a9 9 0 0 1 13 0M9.5 16.5a5 5 0 0 1 5 0M12 20v.5"
            stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
          No stream URL provided.
          <br />
          <span style={{ fontSize: 12, opacity: 0.6 }}>
            Navigate here from a live class card.
          </span>
        </div>
        <button
          onClick={() => goBack(state.backUrl)}
          style={{
            marginTop: 8, padding: "8px 20px", borderRadius: 8,
            background: "#e53935", color: "#fff", fontSize: 14, fontWeight: 600,
            border: "none", cursor: "pointer",
          }}
        >
          Go Home
        </button>
      </div>
    );
  }

  /* ── Ready: render player ────────────────────────────────────────── */
  const { stream } = state;
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <LivePlayer
        streamUrl={stream.streamUrl}
        title={stream.title}
        clearKeys={stream.clearKeys}
        onBack={() => goBack(stream.backUrl)}
      />
    </div>
  );
}
