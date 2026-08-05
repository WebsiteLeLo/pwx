import { useEffect, useRef, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

const PW_API = "https://pwsecure.gourav23032009.workers.dev/api/pw";
const PROXY_BASE = apiUrl("/api");
const ACCENT = "#5a4bda";

interface DrmCache { mpdUrl: string; kid: string; keyHex: string; }
const drmCache = new Map<string, DrmCache>();

// Extract KID directly from MPD XML — no external service needed
function extractKidFromMpd(mpdText: string): string | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(mpdText, "application/xml");
    const cps = doc.querySelectorAll("ContentProtection");
    for (const cp of Array.from(cps)) {
      // Look for default_KID in any namespace (cenc:default_KID)
      for (const attr of Array.from(cp.attributes)) {
        if (attr.localName.toLowerCase() === "default_kid" && attr.value) {
          return attr.value.replace(/-/g, "").toLowerCase();
        }
      }
    }
  } catch { /* noop */ }
  return null;
}

function hexToBase64url(hex: string): string {
  const pairs = hex.match(/.{1,2}/g) ?? [];
  const bytes = new Uint8Array(pairs.map((b) => parseInt(b, 16)));
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const RESUME_KEY = (id: string) => `pw-resume-${id}`;
interface QualityTrack { height: number; bandwidth: number; raw: any; }
type Status = "loading" | "decrypting" | "ready" | "error";
type SettingsPanel = "main" | "speed" | "quality";
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export interface DrmPlayerProps {
  batchId: string;
  subjectId: string;
  childId: string;
  poster?: string;
  title?: string;
  onOpenTimeline?: () => void;
  onOpenAttachments?: () => void;
}

function RwSvg() {
  return (
    <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
      <path fill="white" d="M9.015 13.232a1.109 1.109 0 0 1 1.475-.125 1.001 1.001 0 0 1 .21 1.407A10.97 10.97 0 0 0 8.153 21.56c0 2.192.66 4.336 1.9 6.176a11.723 11.723 0 0 0 5.09 4.195c2.083.898 4.391 1.2 6.648.868a12.065 12.065 0 0 0 6.072-2.738 11.314 11.314 0 0 0 3.55-5.465c.609-2.112.569-4.348-.115-6.44a11.357 11.357 0 0 0-3.74-5.346 12.1 12.1 0 0 0-6.165-2.538l1.454 1.2a1.006 1.006 0 0 1 .118 1.457 1.098 1.098 0 0 1-.735.358 1.106 1.106 0 0 1-.783-.245L17.68 9.94a1.04 1.04 0 0 1-.278-.354 1 1 0 0 1 .278-1.217l3.768-3.101a1.09 1.09 0 0 1 1.66.571 1.04 1.04 0 0 1-.26.317l-1.622 1.337a14.335 14.335 0 0 1 7.422 2.818 13.46 13.46 0 0 1 4.611 6.253c.873 2.47.978 5.13.303 7.655a13.348 13.348 0 0 1-4.106 6.57 14.243 14.243 0 0 1-7.178 3.35c-2.68.423-5.432.09-7.919-.961a13.867 13.867 0 0 1-6.084-4.958A13.051 13.051 0 0 1 6 21.559c-.01-3.024 1.053-5.961 3.015-8.328Z"/>
      <path fill="white" d="M16.02 12.927a1.128 1.128 0 0 1-1.536.112l-3.812-3.101a1.032 1.032 0 0 1-.28-.352.991.991 0 0 1 0-.866c.065-.136.16-.256.28-.352l3.813-3.102a1.141 1.141 0 0 1 1.555.093.991.991 0 0 1-.14 1.477l-2.845 2.318 2.847 2.316a.996.996 0 0 1-.144 1.14.883.883 0 0 1-.738.316Z"/>
      <text x="20.5" y="27" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="sans-serif">10</text>
    </svg>
  );
}

function FwSvg() {
  return (
    <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
      <path fill="white" d="M30.99 13.236a1.11 1.11 0 0 0-1.496-.15 1.003 1.003 0 0 0-.195 1.43 10.965 10.965 0 0 1 2.548 7.045c.001 2.192-.659 4.337-1.899 6.177a11.726 11.726 0 0 1-5.091 4.196 12.303 12.303 0 0 1-6.65.868 12.071 12.071 0 0 1-6.076-2.737 11.313 11.313 0 0 1-3.55-5.465c-.61-2.112-.57-4.348.114-6.44a11.356 11.356 0 0 1 3.74-5.346 12.107 12.107 0 0 1 6.169-2.538l-1.459 1.2a1.008 1.008 0 0 0-.09 1.433 1.11 1.11 0 0 0 1.49.137l3.77-3.101a1.04 1.04 0 0 0 .278-.353 1 1 0 0 0-.277-1.217l-3.77-3.1a1.12 1.12 0 0 0-1.677.405.995.995 0 0 0 .424.989l1.623 1.337a14.34 14.34 0 0 0-7.421 2.82 13.457 13.457 0 0 0-4.61 6.253 12.916 12.916 0 0 0-.299 7.653 13.345 13.345 0 0 0 4.107 6.567 14.248 14.248 0 0 0 7.18 3.346c2.68.424 5.432.09 7.919-.96 2.486-1.051 4.6-2.774 6.085-4.957a13.045 13.045 0 0 0 2.273-7.342c.012-3.023-1.05-5.96-3.012-8.326Z"/>
      <path fill="white" d="M24.029 12.931a1.107 1.107 0 0 0 1.52.112l3.77-3.1a1.04 1.04 0 0 0 .277-.353 1 1 0 0 0-.278-1.217l-3.77-3.1a1.12 1.12 0 0 0-1.677.405.993.993 0 0 0 .424.989l2.814 2.316-2.815 2.316a1.007 1.007 0 0 0-.118 1.457Z"/>
      <text x="20.5" y="27" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="sans-serif">10</text>
    </svg>
  );
}

function VolumeIcon({ level }: { level: "off" | "low" | "high" }) {
  if (level === "off") return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM17.25 9.75l4.5 4.5m0-4.5-4.5 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (level === "low") return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z"/>
    </svg>
  );
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z"/><path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z"/>
    </svg>
  );
}

function CBtn({ onClick, children, title, className = "" }: { onClick?: (e: React.MouseEvent) => void; children: React.ReactNode; title?: string; className?: string }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg bg-transparent border-none cursor-pointer text-white transition-transform active:scale-85 outline-none ${className}`}
    >
      {children}
    </button>
  );
}

export function DrmPlayer({
  batchId, subjectId, childId, poster, title,
  onOpenTimeline, onOpenAttachments,
}: DrmPlayerProps) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const playerRef     = useRef<any>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const seekBarRef    = useRef<HTMLDivElement>(null);
  const hideTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTapRef    = useRef<{ time: number; x: number } | null>(null);
  const touchSeekRef  = useRef(false);
  const menuRef       = useRef<HTMLDivElement>(null);

  const [status, setStatus]         = useState<Status>("loading");
  const [statusMsg, setStatusMsg]   = useState("Initializing…");
  const [error, setError]           = useState("");
  const [attempt, setAttempt]       = useState(0);

  const [playing, setPlaying]             = useState(false);
  const [currentTime, setCurrentTime]     = useState(0);
  const [duration, setDuration]           = useState(0);
  const [buffered, setBuffered]           = useState(0);
  const [volume, setVolume]               = useState(1);
  const [muted, setMuted]                 = useState(false);
  const [speed, setSpeed]                 = useState(1);
  const [fullscreen, setFullscreen]       = useState(false);
  const [showControls, setShowControls]   = useState(true);
  const [showSettings, setShowSettings]   = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel>("main");
  const [seeking, setSeeking]             = useState(false);
  const [qualities, setQualities]         = useState<QualityTrack[]>([]);
  const [activeQuality, setActiveQuality] = useState<number | "auto">("auto");
  const [seekTooltip, setSeekTooltip]     = useState<{ time: number; pct: number } | null>(null);
  const [buffering, setBuffering]         = useState(false);
  const [menuOpen, setMenuOpen]           = useState(false);
  const [isMobile, setIsMobile]           = useState(false);

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
        const cacheKey = `${batchId}:${subjectId}:${childId}`;
        let cached = drmCache.get(cacheKey);

        if (!cached) {
          // ── Step 1: Get MPD URL from pwsecure ──────────────────────────────
          setStatusMsg("Fetching video URL…");
          const videoRes = await fetch(
            `${PW_API}/v1/videos/${encodeURIComponent(childId)}`
          );
          if (!videoRes.ok) throw new Error(`Video details failed (${videoRes.status})`);
          const videoData = await videoRes.json();
          const mpdUrl: string | undefined = videoData?.data?.videoUrl;
          if (!mpdUrl) throw new Error("No MPD URL in video details");

          if (cancelled) return;

          // ── Step 2: Fetch proxied MPD and extract KID client-side ──────────
          setStatusMsg("Extracting encryption key…");
          const mpdRes = await fetch(
            `${PROXY_BASE}/proxy?url=${encodeURIComponent(mpdUrl)}`
          );
          if (!mpdRes.ok) throw new Error(`MPD fetch failed (${mpdRes.status})`);
          const mpdText = await mpdRes.text();
          const kid = extractKidFromMpd(mpdText);
          if (!kid) throw new Error("No KID found in MPD");

          if (cancelled) return;

          // ── Step 3: Exchange KID for ClearKey via pwsecure ────────────────
          setStatusMsg("Decrypting license key…");
          const otpRes = await fetch(
            `${PW_API}/v1/videos/get-otp?key=${encodeURIComponent(kid)}&isEncoded=true`
          );
          if (!otpRes.ok) throw new Error(`OTP fetch failed (${otpRes.status})`);
          const otpData = await otpRes.json();
          const keyHex: string | undefined =
            otpData?.data?.otp ?? otpData?.data?.key ?? otpData?.key;
          if (!keyHex) throw new Error("No decryption key returned");

          cached = { mpdUrl, kid, keyHex };
          drmCache.set(cacheKey, cached);
        } else {
          setStatusMsg("Loading from cache…");
        }

        const { mpdUrl, kid, keyHex } = cached;
        if (cancelled) return;
        setStatus("decrypting");
        setStatusMsg("Initializing player…");

        const kidB64 = hexToBase64url(kid);
        const keyB64 = hexToBase64url(keyHex);

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
        player.configure({
          drm: { clearKeys: { [kidB64]: keyB64 } },
          streaming: {
            bufferingGoal: 60,
            rebufferingGoal: 2,
            bufferBehind: 30,
            safeSeekOffset: 3,
            stallEnabled: false,
            retryParameters: {
              maxAttempts: 4,
              baseDelay: 100,
              backoffFactor: 1.5,
              fuzzFactor: 0.5,
              timeout: 30000,
            },
          },
        });

        player.addEventListener("error", (event: Event) => {
          if (cancelled) return;
          const detail = (event as any).detail ?? event;
          setStatus("error");
          setError(detail?.message || `Playback error (code ${detail?.code ?? "?"})`);
        });

        player.addEventListener("streaming", () => {
          if (cancelled) return;
          const tracks: QualityTrack[] = [];
          const seen = new Set<number>();
          (player.getVariantTracks() as any[])
            .filter((t) => t.type === "variant")
            .sort((a: any, b: any) => b.height - a.height)
            .forEach((t: any) => {
              if (!seen.has(t.height) && t.height) {
                seen.add(t.height);
                tracks.push({ height: t.height, bandwidth: t.bandwidth, raw: t });
              }
            });
          setQualities(tracks);
        });

        await player.load(`${PROXY_BASE}/proxy?url=${encodeURIComponent(mpdUrl)}`);

        if (!cancelled) {
          setStatus("ready");
          try {
            const saved = parseFloat(localStorage.getItem(RESUME_KEY(childId)) || "0");
            if (saved > 0 && saved < (video.duration || Infinity) - 5) {
              video.currentTime = saved;
            }
          } catch {}
          video.play().catch(() => {});
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const e = err as any;
          setStatus("error");
          setError(e instanceof Error ? e.message : e?.message ? String(e.message) : "Unknown error");
        }
      }
    }

    setup();
    return () => {
      cancelled = true;
      if (playerRef.current) {
        playerRef.current.destroy().catch(() => {});
        playerRef.current = null;
      }
    };
  }, [batchId, subjectId, childId, attempt]);

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
    const onWait     = () => setBuffering(true);
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
  }, [status]);

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

  useEffect(() => {
    const onFS = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFS);
    return () => document.removeEventListener("fullscreenchange", onFS);
  }, []);

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

  function selectQuality(height: number | "auto") {
    if (!playerRef.current) return;
    if (height === "auto") {
      playerRef.current.configure({ abr: { enabled: true } });
      setActiveQuality("auto");
    } else {
      playerRef.current.configure({ abr: { enabled: false } });
      const tracks = playerRef.current.getVariantTracks();
      const best = (tracks as any[]).filter((t) => t.height === height).sort((a: any, b: any) => b.bandwidth - a.bandwidth)[0];
      if (best) playerRef.current.selectVariantTrack(best, true);
      setActiveQuality(height);
    }
    setSettingsPanel("main");
    setShowSettings(false);
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
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
  const speedLabel = speed === 1 ? "Normal" : `${speed}x`;
  const volumeLevel: "off" | "low" | "high" = (muted || volume === 0) ? "off" : volume < 0.5 ? "low" : "high";

  const hasPanel = !!(onOpenTimeline || onOpenAttachments);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black select-none overflow-hidden"
      style={{ fontFamily: "'DM Sans', -apple-system, sans-serif" }}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); if (playing) setShowControls(false); }}
      onClick={(e) => { if (status === "ready" && !isMobile) { e.stopPropagation(); togglePlay(); } }}
      onTouchEnd={status === "ready" ? handleTap : undefined}
    >
      <video
        ref={videoRef}
        poster={poster}
        className="absolute inset-0 w-full h-full object-contain bg-black"
        style={{ opacity: status === "ready" ? 1 : 0, transition: "opacity 0.3s", display: "block", outline: "none" }}
        playsInline
        preload="auto"
      />

      {(status === "loading" || status === "decrypting") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: "rgba(0,0,0,.82)" }}>
          <div className="w-10 h-10 rounded-full border-[3px] animate-spin" style={{ borderColor: `rgba(90,75,218,.18)`, borderTopColor: ACCENT }} />
          <p className="text-sm text-white/65">{statusMsg}</p>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-5 text-center" style={{ background: "rgba(0,0,0,.88)" }}>
          <span className="text-4xl">⚠️</span>
          <p className="text-sm text-[#ff6584] max-w-[300px] leading-relaxed">{error}</p>
          <button
            onClick={(e) => { e.stopPropagation(); setAttempt((a) => a + 1); }}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-medium"
            style={{ background: ACCENT }}
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {buffering && status === "ready" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[8]">
          <div className="w-10 h-10 rounded-full border-[3px] animate-spin" style={{ borderColor: `rgba(90,75,218,.18)`, borderTopColor: ACCENT }} />
        </div>
      )}

      {status === "ready" && (
        <div
          className="absolute inset-0 z-20 flex flex-col transition-opacity duration-300"
          style={{ opacity: showControls || !playing ? 1 : 0, pointerEvents: showControls || !playing ? "auto" : "none" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{ background: "linear-gradient(rgba(0,0,0,.72) 0%, transparent 100%)" }}>
            <button
              className="text-white p-1.5 rounded-lg bg-transparent border-none cursor-pointer flex items-center"
              style={{ flexShrink: 0 }}
              onClick={() => window.history.back()}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
              </svg>
            </button>

            <div className="flex-1 min-w-0 text-sm font-medium text-white truncate">{title}</div>

            {hasPanel && (
              <div className="relative flex-shrink-0" ref={menuRef}>
                <button
                  className="text-white p-1.5 rounded-lg bg-transparent border-none cursor-pointer flex items-center"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                    <path fillRule="evenodd" d="M10.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" clipRule="evenodd"/>
                  </svg>
                </button>
                {menuOpen && (
                  <div
                    className="absolute top-full right-0 mt-1 rounded-xl overflow-hidden min-w-[180px] z-50"
                    style={{ background: "rgba(12,12,20,.98)", border: "1px solid rgba(255,255,255,.12)", boxShadow: "0 8px 32px rgba(0,0,0,.9)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onOpenTimeline && (
                      <button
                        className="w-full flex items-center gap-2.5 px-4 py-3.5 text-white text-sm cursor-pointer bg-transparent border-none text-left"
                        style={{ borderBottom: "1px solid rgba(255,255,255,.07)" }}
                        onClick={() => { setMenuOpen(false); onOpenTimeline(); }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3.167 5.583a.083.083 0 01.166 0v12.834a.083.083 0 01-.167 0V5.583zM5.667 17.333a1 1 0 001 1h10.666a1 1 0 001-1V6.667a1 1 0 00-1-1H6.667a1 1 0 00-1 1v10.666zm4.888-3.3V9.966L13.945 12l-3.39 2.034zM20.666 5.583a.083.083 0 11.167 0v12.834a.083.083 0 01-.166 0V5.583z"/>
                        </svg>
                        Timeline
                      </button>
                    )}
                    {onOpenAttachments && (
                      <button
                        className="w-full flex items-center gap-2.5 px-4 py-3.5 text-white text-sm cursor-pointer bg-transparent border-none text-left"
                        onClick={() => { setMenuOpen(false); onOpenAttachments(); }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                        </svg>
                        Attachments
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mid (click area) */}
          <div className="flex-1" />

          {/* Footer */}
          <div className="flex-shrink-0 pb-2" style={{ background: "linear-gradient(transparent 0%, rgba(0,0,0,.82) 100%)" }}>
            {/* Progress bar */}
            <div className="px-3.5 pb-1.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-mono text-[13px] font-medium">{formatTime(currentTime)}</span>
                  {speed !== 1 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,.92)", color: "#000" }}>{speed}x</span>
                  )}
                </div>
                <span className="text-white font-mono text-[13px] font-medium">{formatTime(duration)}</span>
              </div>
              <div
                className="relative h-[22px] flex items-center cursor-pointer touch-none"
                onMouseLeave={() => setSeekTooltip(null)}
              >
                {seekTooltip && (
                  <div
                    className="absolute bottom-full mb-2 -translate-x-1/2 bg-black/90 text-white text-xs font-mono px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap z-10"
                    style={{ left: `${seekTooltip.pct * 100}%` }}
                  >
                    {formatTime(seekTooltip.time)}
                  </div>
                )}
                <div
                  ref={seekBarRef}
                  className="absolute inset-x-0 h-1 rounded-sm overflow-hidden"
                  style={{ background: "rgba(255,255,255,.2)" }}
                >
                  <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${buf * 100}%`, background: "rgba(255,255,255,.3)" }} />
                  <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${played * 100}%`, background: ACCENT }} />
                </div>
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg -translate-x-1/2 pointer-events-none"
                  style={{ left: `${played * 100}%`, boxShadow: "0 0 5px rgba(0,0,0,.6)" }}
                />
                <input
                  type="range" min={0} max={1000} step={1}
                  value={Math.round(played * 1000)}
                  onChange={(e) => {
                    const p = parseInt(e.target.value) / 1000;
                    if (videoRef.current && duration) videoRef.current.currentTime = p * duration;
                  }}
                  onMouseDown={() => setSeeking(true)}
                  onMouseUp={() => { setSeeking(false); setSeekTooltip(null); }}
                  onMouseMove={onSeekMouseMove}
                  onTouchStart={onSeekTouchStart}
                  onTouchMove={onSeekTouchMove}
                  onTouchEnd={onSeekTouchEnd}
                  onClick={onSeekClick}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between px-1.5">
              {/* Left */}
              <div className="flex items-center">
                <CBtn onClick={(e) => { e.stopPropagation(); skip(-10); resetHideTimer(); }} title="Rewind 10s">
                  <RwSvg />
                </CBtn>
                <CBtn onClick={(e) => { e.stopPropagation(); togglePlay(); }} title={playing ? "Pause" : "Play"}>
                  {playing ? (
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="white">
                      <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd"/>
                    </svg>
                  ) : (
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="white">
                      <path d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z"/>
                    </svg>
                  )}
                </CBtn>
                <CBtn onClick={(e) => { e.stopPropagation(); skip(10); resetHideTimer(); }} title="Forward 10s">
                  <FwSvg />
                </CBtn>

                <div
                  className="hidden sm:flex items-center"
                  onMouseEnter={() => {}}
                  onMouseLeave={() => {}}
                  style={{ gap: "0" }}
                >
                  <CBtn onClick={(e) => { e.stopPropagation(); toggleMute(); }} title="Mute (m)">
                    <VolumeIcon level={volumeLevel} />
                  </CBtn>
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={muted ? 0 : volume}
                    onChange={(e) => setVideoVolume(parseFloat(e.target.value))}
                    className="w-0 h-1 opacity-0 cursor-pointer transition-all duration-300 hover:w-14 hover:opacity-100 focus:w-14 focus:opacity-100"
                    style={{ accentColor: ACCENT, marginLeft: 0 }}
                    onFocus={() => {}}
                  />
                </div>
              </div>

              {/* Right */}
              <div className="flex items-center">
                {/* Timeline button (desktop only) */}
                {onOpenTimeline && (
                  <CBtn className="hidden lg:flex" onClick={(e) => { e.stopPropagation(); onOpenTimeline(); }} title="Timeline">
                    <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
                      <path d="M5.1 10a.5.5 0 0 1 .5-.5h.2a.5.5 0 0 1 .5.5v20a.5.5 0 0 1-.5.5h-.2a.5.5 0 0 1-.5-.5V10Z" fill="white"/>
                      <rect x="10.3" y="10.3" width="19.4" height="19.4" rx="1.2" stroke="white" strokeWidth="1.8" fill="none"/>
                      <path d="M17.2 17l5.2 3-5.2 3V17Z" fill="white"/>
                      <path d="M33.7 10a.5.5 0 0 1 .5-.5h.2a.5.5 0 0 1 .5.5v20a.5.5 0 0 1-.5.5h-.2a.5.5 0 0 1-.5-.5V10Z" fill="white"/>
                    </svg>
                  </CBtn>
                )}

                {/* Settings */}
                <div className="relative">
                  <CBtn
                    onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); setSettingsPanel("main"); }}
                    title="Settings"
                  >
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </CBtn>

                  {showSettings && (
                    <div
                      className="absolute bottom-full right-0 mb-2 w-[min(260px,calc(100vw-32px))] rounded-[14px] overflow-hidden z-30"
                      style={{ background: "rgba(10,10,18,.98)", border: "1px solid rgba(255,255,255,.12)", boxShadow: "0 4px 32px rgba(0,0,0,.9)" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {settingsPanel === "main" && (
                        <div>
                          <button
                            className="w-full flex items-center justify-between px-4 py-3.5 text-white text-[15px] font-medium bg-transparent border-none cursor-pointer"
                            style={{ borderBottom: "1px solid rgba(255,255,255,.07)" }}
                            onClick={() => setSettingsPanel("speed")}
                          >
                            <span>Speed</span>
                            <div className="flex items-center gap-1" style={{ color: "rgba(255,255,255,.42)", fontSize: "14px" }}>
                              <span>{speedLabel}</span>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                            </div>
                          </button>
                          {qualities.length > 0 && (
                            <button
                              className="w-full flex items-center justify-between px-4 py-3.5 text-white text-[15px] font-medium bg-transparent border-none cursor-pointer"
                              onClick={() => setSettingsPanel("quality")}
                            >
                              <span>Quality</span>
                              <div className="flex items-center gap-1" style={{ color: "rgba(255,255,255,.42)", fontSize: "14px" }}>
                                <span>{qualityLabel}</span>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                              </div>
                            </button>
                          )}
                        </div>
                      )}

                      {settingsPanel === "speed" && (
                        <div>
                          <button
                            className="flex items-center gap-2.5 w-full px-4 py-3 border-none bg-transparent cursor-pointer"
                            style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}
                            onClick={() => setSettingsPanel("main")}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                            <span className="text-white text-[15px] font-bold">Speed</span>
                          </button>
                          <div className="overflow-y-auto max-h-[220px]">
                            {SPEEDS.map((s) => (
                              <button
                                key={s}
                                className="w-full flex items-center justify-between px-4 py-3 border-none cursor-pointer text-white text-sm"
                                style={{
                                  borderBottom: "1px solid rgba(255,255,255,.06)",
                                  background: speed === s ? `rgba(90,75,218,.2)` : "transparent",
                                }}
                                onClick={() => setVideoSpeed(s)}
                              >
                                <span>{s === 1 ? "Normal" : `${s}x`}</span>
                                <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ border: `2px solid ${speed === s ? ACCENT : "rgba(255,255,255,.3)"}`, background: speed === s ? ACCENT : "transparent" }}>
                                  {speed === s && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {settingsPanel === "quality" && (
                        <div>
                          <button
                            className="flex items-center gap-2.5 w-full px-4 py-3 border-none bg-transparent cursor-pointer"
                            style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}
                            onClick={() => setSettingsPanel("main")}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                            <span className="text-white text-[15px] font-bold">Quality</span>
                          </button>
                          <div className="overflow-y-auto max-h-[220px]">
                            {[{ label: "Auto", value: "auto" as const }, ...qualities.map((q) => ({ label: `${q.height}p`, value: q.height as number | "auto" }))].map((opt) => (
                              <button
                                key={opt.value}
                                className="w-full flex items-center justify-between px-4 py-3 border-none cursor-pointer text-white text-sm"
                                style={{
                                  borderBottom: "1px solid rgba(255,255,255,.06)",
                                  background: activeQuality === opt.value ? `rgba(90,75,218,.2)` : "transparent",
                                }}
                                onClick={() => selectQuality(opt.value)}
                              >
                                <span>{opt.label}</span>
                                <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ border: `2px solid ${activeQuality === opt.value ? ACCENT : "rgba(255,255,255,.3)"}`, background: activeQuality === opt.value ? ACCENT : "transparent" }}>
                                  {activeQuality === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Fullscreen */}
                <CBtn onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} title="Fullscreen (f)">
                  {fullscreen ? (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                      <path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3"/>
                    </svg>
                  ) : (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"/>
                    </svg>
                  )}
                </CBtn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings backdrop */}
      {showSettings && (
        <div
          className="absolute inset-0 z-[25]"
          onClick={(e) => { e.stopPropagation(); setShowSettings(false); }}
        />
      )}
      {menuOpen && (
        <div
          className="absolute inset-0 z-[25]"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
        />
      )}
    </div>
  );
}
