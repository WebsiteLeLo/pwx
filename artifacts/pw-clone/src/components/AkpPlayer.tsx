import { useEffect, useRef, useState, useCallback } from "react";
import { Download, RefreshCw } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { NetworkPing } from "@/components/NetworkPing";

const PROXY_BASE = apiUrl("");
const ACCENT = "#5a4bda";

interface VideoUrlData {
  url: string;
  directUrl?: string;
  streamUrl?: string;
  signedUrl?: string;
  clearKeys?: Record<string, string>;
  vid?: string;
  topic?: string;
}

interface ApiResponse {
  success?: boolean;
  data?: VideoUrlData;
  url?: string;
  directUrl?: string;
  streamUrl?: string;
  signedUrl?: string;
  clearKeys?: Record<string, string>;
  vid?: string;
  topic?: string;
}

function hexToBase64url(hex: string): string {
  const pairs = hex.match(/.{1,2}/g) ?? [];
  const bytes = new Uint8Array(pairs.map((b) => parseInt(b, 16)));
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function isHex32(s: string) {
  return /^[0-9a-fA-F]{32}$/.test(s);
}

function isDirectMediaUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return /\.(mp4|webm|mov|m4v|mkv)(?:$|[?#])/i.test(url.pathname);
  } catch {
    return false;
  }
}

function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const RESUME_KEY = (id: string) => `akp-resume-${id}`;
type Status = "idle" | "loading" | "ready" | "error";
type SettingsPanel = "main" | "speed" | "quality";
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

interface QualityTrack { height: number; bandwidth: number; raw: any; }

export interface AkpPlayerProps {
  batchId: string;
  childId: string;
  poster?: string;
  title?: string;
}

function VolumeIcon({ level }: { level: "off" | "low" | "high" }) {
  if (level === "off")
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM17.25 9.75l4.5 4.5m0-4.5-4.5 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (level === "low")
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
        <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" />
      </svg>
    );
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
      <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

function Btn({ onClick, title, children, className = "" }: { onClick?: (e: React.MouseEvent) => void; title?: string; children: React.ReactNode; className?: string }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`w-10 h-10 flex items-center justify-center rounded-full bg-transparent border-none cursor-pointer text-white transition-colors hover:bg-white/10 active:bg-white/20 outline-none flex-shrink-0 ${className}`}
    >
      {children}
    </button>
  );
}

export function AkpPlayer({ batchId, childId, poster, title }: AkpPlayerProps) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const playerRef    = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seekBarRef   = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeSaveRef= useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTapRef   = useRef<{ time: number; x: number } | null>(null);
  const touchSeekRef = useRef(false);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoveryAttemptsRef = useRef(0);

  const [status, setStatus]         = useState<Status>("idle");
  const [statusMsg, setStatusMsg]   = useState("Initializing…");
  const [error, setError]           = useState("");
  const [attempt, setAttempt]       = useState(0);
  const [videoTitle, setVideoTitle] = useState(title ?? "");

  const [playing, setPlaying]           = useState(false);
  const [currentTime, setCurrentTime]   = useState(0);
  const [duration, setDuration]         = useState(0);
  const [buffered, setBuffered]         = useState(0);
  const [volume, setVolume]             = useState(1);
  const [muted, setMuted]               = useState(false);
  const [speed, setSpeed]               = useState(1);
  const [fullscreen, setFullscreen]     = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel>("main");
  const [seeking, setSeeking]           = useState(false);
  const [qualities, setQualities]       = useState<QualityTrack[]>([]);
  const [activeQuality, setActiveQuality] = useState<number | "auto">("auto");
  const [seekTooltip, setSeekTooltip]   = useState<{ time: number; pct: number } | null>(null);
  const [buffering, setBuffering]       = useState(false);
  const [isMobile, setIsMobile]         = useState(false);
  const [downloadUrl, setDownloadUrl]   = useState("");
  const [downloadMessage, setDownloadMessage] = useState("");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  const scheduleRecovery = useCallback((message: string) => {
    if (reconnectTimerRef.current || recoveryAttemptsRef.current >= 4 || !navigator.onLine) {
      setStatus("error");
      setError(message);
      return;
    }
    const delay = Math.min(1500 * (recoveryAttemptsRef.current + 1), 6000);
    recoveryAttemptsRef.current += 1;
    setStatusMsg(`Connection interrupted — reconnecting in ${Math.ceil(delay / 1000)}s…`);
    setStatus("loading");
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      setAttempt((current) => current + 1);
    }, delay);
  }, []);

  // ── Core setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!batchId || !childId) return;
    let cancelled = false;

    async function setup() {
      setStatus("loading");
      setError("");
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setQualities([]);
      setActiveQuality("auto");

      try {
        // Step 1: Fetch video URL + clearKeys via our own proxy
        setStatusMsg("Fetching video info…");
        const infoRes = await fetch(
          `${PROXY_BASE}/akp-video-url?batchId=${encodeURIComponent(batchId)}&childId=${encodeURIComponent(childId)}`
        );
        if (!infoRes.ok) throw new Error(`Video info fetch failed (${infoRes.status})`);
        const infoJson: ApiResponse = await infoRes.json();

        // Normalise — API may return data at root or inside .data
        const d: VideoUrlData = (infoJson.data ?? infoJson) as VideoUrlData;

        // signedUrl is only the query string (?Signature=...&Policy=...&Key-Pair-Id=...)
        // Combine with the base streamUrl to get the full signed manifest URL.
        const baseUrl = (d.streamUrl ?? d.url ?? d.directUrl ?? "").split("?")[0];
        if (!baseUrl) throw new Error("No stream URL returned by API");
        const signedQs = d.signedUrl ?? ""; // starts with "?" or is empty
        const mpdUrl = signedQs ? `${baseUrl}${signedQs}` : baseUrl;
        setDownloadUrl([d.directUrl, d.url].find(isDirectMediaUrl) ?? "");

        const clearKeys = d.clearKeys ?? {};
        if (!d.topic && d.topic !== "") {
          // noop
        } else if (d.topic) {
          setVideoTitle(d.topic);
        }

        if (cancelled) return;

        // Step 2: Convert clearKeys (hex KID → hex key) to base64url for Shaka
        const shakaKeys: Record<string, string> = {};
        for (const [kid, key] of Object.entries(clearKeys)) {
          if (isHex32(kid) && isHex32(key)) {
            shakaKeys[hexToBase64url(kid)] = hexToBase64url(key);
          }
        }

        setStatusMsg("Initializing player…");

        const shakaModule = await import("shaka-player");
        const shaka = (shakaModule as any).default ?? shakaModule;
        if (cancelled) return;

        shaka.polyfill.installAll();
        const video = videoRef.current;
        if (!video || cancelled) return;

        if (playerRef.current) {
          await playerRef.current.destroy();
          playerRef.current = null;
        }

        const player = new shaka.Player();
        await player.attach(video);
        playerRef.current = player;

        // Keep a safety cushion for short network dips without retaining an
        // unbounded amount of a long lecture behind the playhead.
        player.configure({
          streaming: {
            bufferingGoal: 75,
            rebufferingGoal: 6,
            bufferBehind: 45,
            safeSeekOffset: 3,
            stallEnabled: true,
            stallThreshold: 2,
            gapDetectionThreshold: 0.5,
            retryParameters: {
              maxAttempts: 6,
              baseDelay: 500,
              backoffFactor: 1.5,
              fuzzFactor: 0.5,
              timeout: 20000,
            },
          },
          abr: {
            enabled: true,
            switchInterval: 8,
            bandwidthDowngradeTarget: 0.95,
            bandwidthUpgradeTarget: 0.85,
          },
        });

        // Configure ClearKey DRM if keys present
        if (Object.keys(shakaKeys).length > 0) {
          player.configure({ drm: { clearKeys: shakaKeys } });
        }

        // Shaka resolves segment URLs relative to the MPD base, dropping the
        // CloudFront / CDN signature. Re-attach signature params to every segment
        // request from the same CDN host that arrives without them.
        const sigParams = signedQs.startsWith("?") ? signedQs.slice(1) : signedQs;
        let cdnHostname = "";
        try { cdnHostname = new URL(baseUrl).hostname; } catch {}
        if (sigParams && cdnHostname) {
          player.getNetworkingEngine().registerRequestFilter(
            (_type: number, request: any) => {
              const uri: string = request.uris[0] ?? "";
              // Apply to any request hitting the same CDN host without a signature
              if (
                uri.includes(cdnHostname) &&
                !uri.includes("Signature=") &&
                !uri.includes("signature=")
              ) {
                const sep = uri.includes("?") ? "&" : "?";
                request.uris[0] = `${uri}${sep}${sigParams}`;
              }
            }
          );
        }

        player.addEventListener("error", (event: Event) => {
          if (cancelled) return;
          const detail = (event as any).detail ?? event;
          const code = Number(detail?.code ?? 0);
          const message = detail?.message || `Playback error (code ${code || "?"})`;
          const transient =
            (code >= 7000 && code < 8000) ||
            code === 1001 ||
            code === 1002 ||
            /network|timeout|fetch|load|connection/i.test(message);
          if (transient) scheduleRecovery(message);
          else {
            setStatus("error");
            setError(message);
          }
        });

        player.addEventListener("streaming", () => {
          if (cancelled) return;
          const tracks: QualityTrack[] = [];
          const seen = new Set<number>();
          (player.getVariantTracks() as any[])
            .filter((t: any) => t.type === "variant")
            .sort((a: any, b: any) => b.height - a.height)
            .forEach((t: any) => {
              if (!seen.has(t.height) && t.height) {
                seen.add(t.height);
                tracks.push({ height: t.height, bandwidth: t.bandwidth, raw: t });
              }
            });
          setQualities(tracks);
        });

        await player.load(mpdUrl);

        if (!cancelled) {
          recoveryAttemptsRef.current = 0;
          setStatus("ready");
          try {
            const saved = parseFloat(localStorage.getItem(RESUME_KEY(childId)) ?? "0");
            if (saved > 0 && saved < (video.duration || Infinity) - 5) {
              video.currentTime = saved;
            }
          } catch {}
          video.play().catch(() => {});
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const e = err as any;
          const message = e instanceof Error ? e.message : e?.message ? String(e.message) : "Unknown error";
          if (/network|timeout|fetch|load|connection|failed/i.test(message)) scheduleRecovery(message);
          else {
            setStatus("error");
            setError(message);
          }
        }
      }
    }

    setup();
    return () => {
      cancelled = true;
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (playerRef.current) {
        playerRef.current.destroy().catch(() => {});
        playerRef.current = null;
      }
    };
  }, [batchId, childId, attempt]);

  // ── Video event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime     = () => setCurrentTime(video.currentTime);
    const onDur      = () => setDuration(video.duration);
    const onPlay     = () => { setPlaying(true); setBuffering(false); };
    const onPause    = () => setPlaying(false);
    const onVol      = () => { setVolume(video.volume); setMuted(video.muted); };
    const onProgress = () => {
      if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1));
    };
     const onWait     = () => {
       setBuffering(true);
       if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
       const wasPlaying = !video.paused;
       stallTimerRef.current = setTimeout(() => {
         stallTimerRef.current = null;
         if (wasPlaying && video.paused === false && video.readyState < 3) {
           try { localStorage.setItem(RESUME_KEY(childId), String(video.currentTime)); } catch {}
           scheduleRecovery("Video is taking too long to buffer.");
         }
       }, 8000);
     };
    const onCanPlay  = () => setBuffering(false);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("durationchange", onDur);
    video.addEventListener("loadedmetadata", onDur);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVol);
    video.addEventListener("progress", onProgress);
    video.addEventListener("waiting", onWait);
    video.addEventListener("canplay", onCanPlay);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("durationchange", onDur);
      video.removeEventListener("loadedmetadata", onDur);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("volumechange", onVol);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("waiting", onWait);
      video.removeEventListener("canplay", onCanPlay);
    };
  }, [status, childId, scheduleRecovery]);

  // ── Resume position saver ────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "ready") return;
    resumeSaveRef.current = setInterval(() => {
      const v = videoRef.current;
      if (v && v.currentTime > 2) {
        try { localStorage.setItem(RESUME_KEY(childId), String(v.currentTime)); } catch {}
      }
    }, 5000);
    return () => { if (resumeSaveRef.current) clearInterval(resumeSaveRef.current); };
  }, [status, childId]);

  // ── Fullscreen listener ──────────────────────────────────────────────────
  useEffect(() => {
    const onFS = () => setFullscreen(!!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement
    ));
    document.addEventListener("fullscreenchange", onFS);
    document.addEventListener("webkitfullscreenchange", onFS);
    document.addEventListener("mozfullscreenchange", onFS);
    const video = videoRef.current;
    const onVideoFS = () => setFullscreen(true);
    const onVideoExitFS = () => setFullscreen(false);
    video?.addEventListener("webkitbeginfullscreen", onVideoFS);
    video?.addEventListener("webkitendfullscreen", onVideoExitFS);
    return () => {
      document.removeEventListener("fullscreenchange", onFS);
      document.removeEventListener("webkitfullscreenchange", onFS);
      document.removeEventListener("mozfullscreenchange", onFS);
      video?.removeEventListener("webkitbeginfullscreen", onVideoFS);
      video?.removeEventListener("webkitendfullscreen", onVideoExitFS);
    };
  }, []);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "ready") return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const v = videoRef.current;
      if (!v) return;
      switch (e.key) {
        case " ": case "k":
          e.preventDefault(); v.paused ? v.play() : v.pause(); resetHideTimer(); break;
        case "ArrowRight": case "l":
          e.preventDefault(); v.currentTime = Math.min(v.currentTime + 10, v.duration); resetHideTimer(); break;
        case "ArrowLeft": case "j":
          e.preventDefault(); v.currentTime = Math.max(v.currentTime - 10, 0); resetHideTimer(); break;
        case "ArrowUp":
          e.preventDefault(); v.volume = Math.min(v.volume + 0.1, 1); break;
        case "ArrowDown":
          e.preventDefault(); v.volume = Math.max(v.volume - 0.1, 0); break;
        case "m": v.muted = !v.muted; break;
        case "f": toggleFullscreen(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, resetHideTimer]);

  // ── Actions ──────────────────────────────────────────────────────────────
  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
    resetHideTimer();
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }

  function setVideoVolume(val: number) {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
  }

  function setVideoSpeed(s: number) {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setSpeed(s);
    setSettingsPanel("main");
    setShowSettings(false);
  }

  function handleDownload() {
    if (!downloadUrl) {
      setDownloadMessage("Is protected stream ke liye downloadable file available nahi hai.");
      window.setTimeout(() => setDownloadMessage(""), 4200);
      return;
    }

    const filename = `${(videoTitle || title || "pwx-video")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "pwx-video"}.mp4`;
    const link = document.createElement("a");
    link.href = `${PROXY_BASE}/video-download?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(filename)}`;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setDownloadMessage("Download start ho gaya.");
    window.setTimeout(() => setDownloadMessage(""), 3000);
  }

  function selectQuality(height: number | "auto") {
    if (!playerRef.current) return;
    if (height === "auto") {
      playerRef.current.configure({ abr: { enabled: true } });
      setActiveQuality("auto");
    } else {
      playerRef.current.configure({ abr: { enabled: false } });
      const tracks = playerRef.current.getVariantTracks();
      const best = (tracks as any[])
        .filter((t: any) => t.height === height)
        .sort((a: any, b: any) => b.bandwidth - a.bandwidth)[0];
      if (best) playerRef.current.selectVariantTrack(best, true);
      setActiveQuality(height);
    }
    setSettingsPanel("main");
    setShowSettings(false);
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    const video = videoRef.current;
    if (!el || !video) return;
    const isFS = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement
    );
    if (!isFS) {
      // iOS Safari requires fullscreen on the video element itself
      if ((video as any).webkitEnterFullscreen) {
        (video as any).webkitEnterFullscreen();
      } else if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if ((el as any).webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
      } else if ((el as any).mozRequestFullScreen) {
        (el as any).mozRequestFullScreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      }
    }
  }

  function skip(secs: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.currentTime + secs, v.duration));
    resetHideTimer();
  }

  function getSeekRatio(clientX: number) {
    const bar = seekBarRef.current;
    if (!bar || !duration) return null;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
  }

  function onSeekClick(e: React.MouseEvent<HTMLDivElement>) {
    const ratio = getSeekRatio(e.clientX);
    if (ratio === null) return;
    videoRef.current!.currentTime = ratio * duration;
    resetHideTimer();
  }

  function onSeekMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const bar = seekBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
    setSeekTooltip({ time: pct * duration, pct });
    if (seeking) videoRef.current!.currentTime = pct * duration;
  }

  function onSeekTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    e.stopPropagation();
    touchSeekRef.current = true;
    setSeeking(true);
    const ratio = getSeekRatio(e.touches[0].clientX);
    if (ratio !== null) videoRef.current!.currentTime = ratio * duration;
  }

  function onSeekTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (!touchSeekRef.current) return;
    const ratio = getSeekRatio(e.touches[0].clientX);
    if (ratio !== null) videoRef.current!.currentTime = ratio * duration;
  }

  function onSeekTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    e.stopPropagation();
    touchSeekRef.current = false;
    setSeeking(false);
  }

  function handleTap(e: React.TouchEvent<HTMLDivElement>) {
    if (touchSeekRef.current) return;
    e.preventDefault();
    const now = Date.now();
    const touch = e.changedTouches[0];
    const rect = containerRef.current!.getBoundingClientRect();
    const relX = touch.clientX - rect.left;

    if (lastTapRef.current && now - lastTapRef.current.time < 280) {
      const side = relX < rect.width / 2 ? "left" : "right";
      skip(side === "right" ? 10 : -10);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { time: now, x: relX };
      setTimeout(() => {
        if (lastTapRef.current && Date.now() - lastTapRef.current.time >= 280) {
          setShowControls((v) => { if (!v) resetHideTimer(); return !v; });
          lastTapRef.current = null;
        }
      }, 300);
    }
  }

  const played = duration ? currentTime / duration : 0;
  const buf    = duration ? buffered / duration : 0;
  const qualityLabel = activeQuality === "auto" ? "Auto" : `${activeQuality}p`;
  const speedLabel   = speed === 1 ? "Normal" : `${speed}x`;
  const volumeLevel: "off" | "low" | "high" =
    (muted || volume === 0) ? "off" : volume < 0.5 ? "low" : "high";

  const displayTitle = videoTitle || title || "";

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black select-none overflow-hidden"
      style={{ fontFamily: "'DM Sans', -apple-system, sans-serif" }}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        if (playing) setShowControls(false);
      }}
      onClick={(e) => { if (status === "ready" && !isMobile) { e.stopPropagation(); togglePlay(); } }}
      onTouchEnd={status === "ready" ? handleTap : undefined}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        poster={poster}
        className="absolute inset-0 w-full h-full object-contain bg-black"
        style={{ opacity: status === "ready" ? 1 : 0, transition: "opacity 0.3s", display: "block", outline: "none" }}
        playsInline
        preload="auto"
      />

      {/* Loading / decrypting overlay */}
      {(status === "loading") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"
          style={{ background: "radial-gradient(ellipse at center, #0d1117 0%, #060a10 100%)" }}>
          {/* Animated rings */}
          {[160, 260, 360].map((size, i) => (
            <div key={size} className="absolute rounded-full animate-ping"
              style={{
                width: size, height: size,
                border: "1px solid rgba(90,75,218,0.20)",
                animationDuration: `${2 + i * 0.6}s`,
                animationDelay: `${i * 0.4}s`,
              }} />
          ))}
          {/* Spinner */}
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-[3px] animate-spin"
              style={{ borderColor: "rgba(90,75,218,.15)", borderTopColor: ACCENT, animationDuration: "0.8s" }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #5a4bda, #8b5cf6)", boxShadow: `0 0 20px rgba(90,75,218,0.5)` }}>
                <div style={{ width: 0, height: 0, borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderLeft: "11px solid #fff", marginLeft: 2 }} />
              </div>
            </div>
          </div>
          {/* Logo + text */}
          <div className="flex flex-col items-center gap-2 mt-2">
            <div className="text-xl font-bold tracking-widest text-white">
              PW<span style={{ color: ACCENT }}>X</span>
            </div>
            <div className="text-xs text-white/40 tracking-widest uppercase">{statusMsg}</div>
          </div>
          {/* Progress shimmer */}
          <div className="w-40 h-0.5 rounded-full overflow-hidden mt-1" style={{ background: "rgba(255,255,255,.08)" }}>
            <div className="h-full w-[60%] rounded-full animate-[shimmer_1.6s_ease-in-out_infinite]"
              style={{ background: "linear-gradient(90deg, transparent, #818cf8, transparent)" }} />
          </div>
        </div>
      )}

      {/* Error overlay */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-5 text-center"
          style={{ background: "rgba(0,0,0,.92)" }}>
          <span className="text-4xl">⚠️</span>
          <p className="text-sm text-[#ff6584] max-w-xs leading-relaxed">{error}</p>
          <button
            onClick={(e) => { e.stopPropagation(); setAttempt((a) => a + 1); }}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-medium"
            style={{ background: ACCENT }}
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* Buffering spinner */}
      {buffering && status === "ready" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[8]">
          <div className="w-10 h-10 rounded-full border-[3px] animate-spin"
            style={{ borderColor: "rgba(90,75,218,.18)", borderTopColor: ACCENT }} />
        </div>
      )}

      {/* Controls overlay */}
      {status === "ready" && (
        <div
          className="absolute inset-0 z-20 flex flex-col transition-opacity duration-200"
          style={{ opacity: showControls || !playing ? 1 : 0, pointerEvents: showControls || !playing ? "auto" : "none" }}
          onClick={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div
            className="flex items-center gap-1 px-1 pt-1 pb-10 flex-shrink-0"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,.88) 0%, transparent 100%)" }}
          >
            <Btn onClick={() => window.history.back()} title="Back">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
              </svg>
            </Btn>
            {displayTitle && (
              <div className="flex-1 min-w-0 text-[13px] font-semibold text-white/90 truncate leading-snug ml-1 pr-2">{displayTitle}</div>
            )}
          </div>

          {/* ── Centre (mobile skip+play, desktop invisible) ── */}
          <div className="flex-1 flex items-center justify-center gap-10 pointer-events-none">
            {isMobile && (
              <>
                <button
                  className="pointer-events-auto flex flex-col items-center gap-1.5 border-none bg-transparent cursor-pointer outline-none"
                  onClick={(e) => { e.stopPropagation(); skip(-10); }}
                >
                  <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,.5)", backdropFilter: "blur(6px)", border: "1.5px solid rgba(255,255,255,.18)" }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
                      <path d="M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62A7.11 7.11 0 0 1 12.5 10.5c3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
                      <text x="12" y="21" textAnchor="middle" fontSize="5.5" fill="white" fontWeight="bold">10</text>
                    </svg>
                  </div>
                  <span className="text-white/60 text-[11px] font-medium tracking-wide">10 sec</span>
                </button>

                <button
                  className="pointer-events-auto border-none bg-transparent cursor-pointer outline-none"
                  onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                >
                  <div className="w-[64px] h-[64px] rounded-full flex items-center justify-center" style={{ background: "rgba(90,75,218,.75)", boxShadow: "0 0 28px rgba(90,75,218,.55), 0 4px 16px rgba(0,0,0,.4)" }}>
                    {playing ? (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    ) : (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                    )}
                  </div>
                </button>

                <button
                  className="pointer-events-auto flex flex-col items-center gap-1.5 border-none bg-transparent cursor-pointer outline-none"
                  onClick={(e) => { e.stopPropagation(); skip(10); }}
                >
                  <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,.5)", backdropFilter: "blur(6px)", border: "1.5px solid rgba(255,255,255,.18)" }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
                      <path d="M18.4 10.6C16.55 9 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5a7.1 7.1 0 0 1 5.12 1.88L13 16h9V7l-3.6 3.6z"/>
                      <text x="12" y="21" textAnchor="middle" fontSize="5.5" fill="white" fontWeight="bold">10</text>
                    </svg>
                  </div>
                  <span className="text-white/60 text-[11px] font-medium tracking-wide">10 sec</span>
                </button>
              </>
            )}
          </div>

          {/* ── Footer ── */}
          <div
            className="flex-shrink-0"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,.95) 0%, rgba(0,0,0,.65) 55%, transparent 100%)" }}
          >
            {/* Seekbar */}
            <div
              className="group px-3 pt-3 pb-0 cursor-pointer relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Tooltip */}
              {seekTooltip && (
                <div
                  className="absolute -translate-x-1/2 bg-black/90 text-white text-[11px] font-mono px-2 py-0.5 rounded-md pointer-events-none whitespace-nowrap z-10"
                  style={{ left: `calc(${seekTooltip.pct * 100}% + 12px)`, bottom: "calc(100% - 8px)" }}
                >
                  {formatTime(seekTooltip.time)}
                </div>
              )}

              {/* Track + hit area */}
              <div
                className="relative h-8 flex items-center"
                ref={seekBarRef}
                onClick={onSeekClick}
                onMouseMove={onSeekMouseMove}
                onMouseLeave={() => { setSeekTooltip(null); if (seeking) setSeeking(false); }}
                onMouseDown={() => setSeeking(true)}
                onMouseUp={() => setSeeking(false)}
                onTouchStart={onSeekTouchStart}
                onTouchMove={onSeekTouchMove}
                onTouchEnd={onSeekTouchEnd}
              >
                {/* Visual track */}
                <div
                  className="absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full overflow-hidden transition-all duration-150"
                  style={{ height: seeking ? "5px" : "3px" }}
                >
                  <div className="absolute inset-0 rounded-full" style={{ background: "rgba(255,255,255,.2)" }} />
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${buf * 100}%`, background: "rgba(255,255,255,.38)" }} />
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${played * 100}%`, background: `linear-gradient(90deg, ${ACCENT}, #8b5cf6)` }} />
                </div>
                {/* Thumb */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[15px] h-[15px] rounded-full bg-white pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `${played * 100}%`, boxShadow: "0 0 8px rgba(90,75,218,.7), 0 1px 4px rgba(0,0,0,.5)" }}
                />
              </div>
            </div>

            {/* Controls row */}
            <div className="flex items-center px-1.5 pb-2 gap-0">
              {/* Skip back */}
              <Btn title="Back 10s" onClick={(e) => { e.stopPropagation(); skip(-10); }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62A7.11 7.11 0 0 1 12.5 10.5c3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
                  <text x="12" y="21" textAnchor="middle" fontSize="5.5" fill="white" fontWeight="bold">10</text>
                </svg>
              </Btn>

              {/* Play/Pause */}
              <Btn title={playing ? "Pause" : "Play"} onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
                {playing ? (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                ) : (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                )}
              </Btn>

              {/* Skip forward */}
              <Btn title="Forward 10s" onClick={(e) => { e.stopPropagation(); skip(10); }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M18.4 10.6C16.55 9 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5a7.1 7.1 0 0 1 5.12 1.88L13 16h9V7l-3.6 3.6z"/>
                  <text x="12" y="21" textAnchor="middle" fontSize="5.5" fill="white" fontWeight="bold">10</text>
                </svg>
              </Btn>

              {/* Volume (desktop) */}
              <div className="hidden sm:flex items-center">
                <Btn title="Mute" onClick={(e) => { e.stopPropagation(); toggleMute(); }}>
                  <VolumeIcon level={volumeLevel} />
                </Btn>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={muted ? 0 : volume}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setVideoVolume(parseFloat(e.target.value))}
                  className="w-[68px] cursor-pointer h-[3px] rounded-full"
                  style={{ accentColor: ACCENT }}
                />
              </div>

              {/* Time display */}
              <div className="flex items-center ml-2 gap-0.5">
                <span className="text-white font-mono text-[12px] tabular-nums">{formatTime(currentTime)}</span>
                <span className="text-white/35 font-mono text-[12px] mx-0.5">/</span>
                <span className="text-white/55 font-mono text-[12px] tabular-nums">{formatTime(duration)}</span>
                {speed !== 1 && (
                  <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `rgba(90,75,218,.85)`, color: "#fff" }}>{speed}×</span>
                )}
              </div>

              <div className="flex-1" />

              <NetworkPing accent={ACCENT} />

              <Btn
                title="Download video"
                onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                className={!downloadUrl ? "opacity-75" : ""}
              >
                <Download className="w-[19px] h-[19px]" />
              </Btn>

              {/* Settings */}
              <div className="relative">
                <Btn
                  title="Settings"
                  onClick={(e) => { e.stopPropagation(); setShowSettings((v) => !v); setSettingsPanel("main"); }}
                  className={showSettings ? "bg-white/15 hover:bg-white/15" : ""}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                </Btn>

                {showSettings && (
                  <div
                    className="absolute bottom-[calc(100%+8px)] right-0 w-[200px] rounded-2xl overflow-hidden z-50"
                    style={{ background: "rgba(12,12,20,.98)", border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 8px 40px rgba(0,0,0,.95)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {settingsPanel === "main" && (
                      <div>
                        <button
                          className="w-full flex items-center justify-between px-4 py-3.5 text-white text-[14px] cursor-pointer bg-transparent border-none text-left hover:bg-white/5 transition-colors"
                          style={{ borderBottom: "1px solid rgba(255,255,255,.07)" }}
                          onClick={() => setSettingsPanel("speed")}
                        >
                          <span className="text-white/75">Speed</span>
                          <div className="flex items-center gap-1 text-white/50 text-[13px]">
                            <span>{speedLabel}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                          </div>
                        </button>
                        {qualities.length > 0 && (
                          <button
                            className="w-full flex items-center justify-between px-4 py-3.5 text-white text-[14px] cursor-pointer bg-transparent border-none text-left hover:bg-white/5 transition-colors"
                            onClick={() => setSettingsPanel("quality")}
                          >
                            <span className="text-white/75">Quality</span>
                            <div className="flex items-center gap-1 text-white/50 text-[13px]">
                              <span>{qualityLabel}</span>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                            </div>
                          </button>
                        )}
                      </div>
                    )}
                    {settingsPanel === "speed" && (
                      <div>
                        <button
                          className="flex items-center gap-2 w-full px-4 py-3 border-none bg-transparent cursor-pointer hover:bg-white/5 transition-colors"
                          style={{ borderBottom: "1px solid rgba(255,255,255,.07)" }}
                          onClick={() => setSettingsPanel("main")}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                          <span className="text-white text-[14px] font-semibold">Speed</span>
                        </button>
                        {SPEEDS.map((s) => (
                          <button key={s}
                            className="w-full flex items-center justify-between px-4 py-3 border-none cursor-pointer text-white text-[13px] transition-colors hover:bg-white/5"
                            style={{ background: speed === s ? `rgba(90,75,218,.22)` : "transparent", borderBottom: "1px solid rgba(255,255,255,.05)" }}
                            onClick={() => setVideoSpeed(s)}
                          >
                            <span>{s === 1 ? "Normal" : `${s}×`}</span>
                            {speed === s && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {settingsPanel === "quality" && (
                      <div>
                        <button
                          className="flex items-center gap-2 w-full px-4 py-3 border-none bg-transparent cursor-pointer hover:bg-white/5 transition-colors"
                          style={{ borderBottom: "1px solid rgba(255,255,255,.07)" }}
                          onClick={() => setSettingsPanel("main")}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                          <span className="text-white text-[14px] font-semibold">Quality</span>
                        </button>
                        {[{ label: "Auto", value: "auto" as const }, ...qualities.map((q) => ({ label: `${q.height}p`, value: q.height as number | "auto" }))].map((opt) => (
                          <button key={opt.value}
                            className="w-full flex items-center justify-between px-4 py-3 border-none cursor-pointer text-white text-[13px] transition-colors hover:bg-white/5"
                            style={{ background: activeQuality === opt.value ? `rgba(90,75,218,.22)` : "transparent", borderBottom: "1px solid rgba(255,255,255,.05)" }}
                            onClick={() => selectQuality(opt.value)}
                          >
                            <span>{opt.label}</span>
                            {activeQuality === opt.value && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Fullscreen */}
              <Btn title={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}>
                {fullscreen ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"/></svg>
                )}
              </Btn>
            </div>
          </div>
          {downloadMessage && (
            <div
              className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-lg px-3 py-2 text-xs text-white whitespace-nowrap z-50"
              style={{ background: "rgba(12,12,20,.94)", border: "1px solid rgba(255,255,255,.14)" }}
            >
              {downloadMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
