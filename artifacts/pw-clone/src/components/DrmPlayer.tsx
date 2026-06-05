import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

const API_BASE = "https://learnbyakp.onrender.com/api/pw";

function hexToBase64url(hex: string): string {
  const pairs = hex.match(/.{1,2}/g) ?? [];
  const bytes = new Uint8Array(pairs.map((b) => parseInt(b, 16)));
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

interface DrmPlayerProps {
  batchId: string;
  subjectId: string;
  /** scheduleId — used as childId in the video-url-details API */
  childId: string;
  poster?: string;
}

type Status = "loading" | "decrypting" | "ready" | "error";

export function DrmPlayer({ batchId, subjectId, childId, poster }: DrmPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<unknown>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [statusMsg, setStatusMsg] = useState("Fetching video info…");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!batchId || !subjectId || !childId) return;

    let cancelled = false;

    async function setup() {
      setStatus("loading");
      setError("");

      try {
        setStatusMsg("Fetching video URL…");
        const urlRes = await fetch(
          `${API_BASE}/video-url-details?batchId=${encodeURIComponent(batchId)}&childId=${encodeURIComponent(childId)}&subjectId=${encodeURIComponent(subjectId)}`
        );
        if (!urlRes.ok) throw new Error(`video-url-details failed (${urlRes.status})`);
        const urlData = await urlRes.json();
        const mpdUrl: string | undefined = urlData?.data?.[0]?.url;
        if (!mpdUrl) throw new Error("No MPD URL returned from server");

        if (cancelled) return;
        setStatusMsg("Extracting encryption key ID…");
        const kidRes = await fetch(`${API_BASE}/kid?mpdUrl=${encodeURIComponent(mpdUrl)}`);
        if (!kidRes.ok) throw new Error(`KID extraction failed (${kidRes.status})`);
        const kidData = await kidRes.json();
        const kid: string | undefined = kidData?.kid;
        if (!kid) throw new Error("No KID found in MPD");

        if (cancelled) return;
        setStatusMsg("Decrypting license key…");
        const otpRes = await fetch(`${API_BASE}/otp?kid=${encodeURIComponent(kid)}`);
        if (!otpRes.ok) throw new Error(`OTP fetch failed (${otpRes.status})`);
        const otpData = await otpRes.json();
        const keyHex: string | undefined = otpData?.key;
        if (!keyHex) throw new Error("No decryption key returned");

        if (cancelled) return;
        setStatus("decrypting");
        setStatusMsg("Initializing player…");

        const kidB64 = hexToBase64url(kid);
        const keyB64 = hexToBase64url(keyHex);

        const shakaModule = await import("shaka-player");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shaka = (shakaModule as any).default ?? shakaModule;

        if (cancelled) return;

        shaka.polyfill.installAll();

        const video = videoRef.current;
        if (!video || cancelled) return;

        if (playerRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (playerRef.current as any).destroy();
          playerRef.current = null;
        }

        const player = new shaka.Player();
        await player.attach(video);
        playerRef.current = player;

        player.configure({
          drm: { clearKeys: { [kidB64]: keyB64 } },
        });

        player.addEventListener("error", (event: Event) => {
          if (cancelled) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detail = (event as any).detail ?? (event as any);
          const code = detail?.code;
          const msg = detail?.message || `Playback error (code ${code ?? "?"})`;
          console.error("[DrmPlayer] Shaka error event:", detail);
          setStatus("error");
          setError(msg);
        });

        const proxiedMpdUrl = `/api/proxy?url=${encodeURIComponent(mpdUrl)}`;
        console.log("[DrmPlayer] Loading DASH stream via proxy:", proxiedMpdUrl);
        await player.load(proxiedMpdUrl);

        if (!cancelled) {
          setStatus("ready");
          video.play().catch(() => {});
        }
      } catch (err: unknown) {
        if (!cancelled) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e = err as any;
          const code = e?.code;
          const msg: string =
            e instanceof Error
              ? e.message
              : e?.message
              ? String(e.message)
              : code != null
              ? `Shaka error code ${code}`
              : "Unknown error";
          console.error("[DrmPlayer] catch error:", err);
          setStatus("error");
          setError(msg);
        }
      }
    }

    setup();

    return () => {
      cancelled = true;
      if (playerRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (playerRef.current as any).destroy().catch(() => {});
        playerRef.current = null;
      }
    };
  }, [batchId, subjectId, childId, attempt]);

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        controls
        poster={poster}
        className="w-full h-full object-contain"
        style={{ opacity: status === "ready" ? 1 : 0, transition: "opacity 0.3s" }}
      />

      {(status === "loading" || status === "decrypting") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <span className="text-sm text-zinc-400">{statusMsg}</span>
          {status === "decrypting" && (
            <span className="text-[11px] text-zinc-600">Setting up DRM playback…</span>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-zinc-300 text-sm text-center max-w-xs px-4">{error}</p>
          <button
            onClick={() => setAttempt((a) => a + 1)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
