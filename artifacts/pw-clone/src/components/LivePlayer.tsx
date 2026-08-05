import { useEffect, useRef, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";

const ACCENT = "#e53935";       // red accent for LIVE
const ACCENT_PURPLE = "#5a4bda";

/* ── helpers ─────────────────────────────────────────────────────────────── */
function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function hexToBase64url(hex: string): string {
  const pairs = hex.match(/.{1,2}/g) ?? [];
  const bytes = new Uint8Array(pairs.map((b) => parseInt(b, 16)));
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function isHex32(s: string) { return /^[0-9a-fA-F]{32}$/.test(s); }

/* ── sub-components ──────────────────────────────────────────────────────── */
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

function Btn({
  onClick, title, children, className = "",
}: {
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
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

/* ── Live badge ──────────────────────────────────────────────────────────── */
function LiveBadge({ isAtLive }: { isAtLive: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase select-none cursor-pointer"
        style={{
          background: isAtLive ? ACCENT : "rgba(255,255,255,0.18)",
          color: "#fff",
          transition: "background 0.3s",
        }}
      >
        {isAtLive && (
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: "#fff", boxShadow: "0 0 4px #fff" }}
          />
        )}
        LIVE
      </span>
    </div>
  );
}

/* ── types ───────────────────────────────────────────────────────────────── */
type Status = "idle" | "loading" | "ready" | "error" | "ended";
type SettingsPanel = "main" | "speed" | "quality";
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface QualityTrack { height: number; bandwidth: number; raw: any }

export interface LivePlayerProps {
  /** Direct HLS (.m3u8) or DASH (.mpd) URL for the live stream */
  streamUrl: string;
  /** Optional poster image */
  poster?: string;
  /** Lecture / stream title shown in header */
  title?: string;
  /** ClearKey DRM keys: Record<hexKID, hexKey> */
  clearKeys?: Record<string, string>;
  /** Called when user taps the back button */
  onBack?: () => void;
}

/* ══════════════════════════════════════════════════════════════════════════
   LivePlayer
══════════════════════════════════════════════════════════════════════════ */
export function LivePlayer({
  streamUrl,
  poster,
  title = "",
  clearKeys = {},
  onBack,
}: LivePlayerProps) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const playerRef     = useRef<any>(null); // shaka or hls instance
  const hlsRef        = useRef<any>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const seekBarRef    = useRef<HTMLDivElement>(null);
  const hideTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchSeekRef  = useRef(false);
  const lastTapRef    = useRef<{ time: number; x: number } | null>(null);
  const reconnectRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);

  const [status, setStatus]           = useState<Status>("idle");
  const [statusMsg, setStatusMsg]     = useState("Initializing…");
  const [error, setError]             = useState("");
  const [attempt, setAttempt]         = useState(0);

  const [playing, setPlaying]         = useState(false);
  const [muted, setMuted]             = useState(false);
  const [volume, setVolume]           = useState(1);
  const [fullscreen, setFullscreen]   = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffering, setBuffering]     = useState(false);
  const [isMobile, setIsMobile]       = useState(false);
  const [seeking, setSeeking]         = useState(false);

  // DVR / seekable range
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0); // seekable range length (0 if no DVR)
  const [dvrOffset, setDvrOffset]     = useState(0); // how far behind live edge
  const [hasDvr, setHasDvr]           = useState(false);
  const [isAtLive, setIsAtLive]       = useState(true);
  const [seekTooltip, setSeekTooltip] = useState<{ time: number; pct: number } | null>(null);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel>("main");
  const [qualities, setQualities]     = useState<QualityTrack[]>([]);
  const [activeQuality, setActiveQuality] = useState<number | "auto">("auto");
  const [speed, setSpeed]             = useState(1);

  // mobile check
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

  /* ── Detect HLS vs DASH ─────────────────────────────────────────────── */
  const isHls = /\.m3u8/i.test(streamUrl) || streamUrl.includes("m3u8");
  const isDash = /\.mpd/i.test(streamUrl) || streamUrl.includes("mpd");

  /* ── Core setup ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!streamUrl) return;
    let cancelled = false;

    async function setup() {
      setStatus("loading");
      setStatusMsg("Connecting to live stream…");
      setError("");
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setHasDvr(false);
      setIsAtLive(true);
      setQualities([]);

      const video = videoRef.current;
      if (!video) return;

      // Destroy previous instances
      if (playerRef.current) {
        try { await playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch {}
        hlsRef.current = null;
      }

      try {
        /* ── HLS path ── */
        if (isHls) {
          // Try native HLS first (Safari)
          if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = streamUrl;
            await video.play();
            if (!cancelled) setStatus("ready");
            return;
          }

          // hls.js for Chrome/Firefox
          setStatusMsg("Loading HLS engine…");
          const HlsModule = await import("hls.js");
          const Hls = (HlsModule as any).default ?? HlsModule;
          if (!Hls.isSupported()) throw new Error("HLS is not supported in this browser");
          if (cancelled) return;

          // ── Signature re-attachment ────────────────────────────────────
          // HLS.js resolves variant playlists / segments relative to the master
          // manifest URL and strips query params (CloudFront signature) → 403.
          // We extract the signature from the original streamUrl and build a
          // fully self-contained fetch-based loader (no Hls.DefaultConfig.loader
          // dependency) that re-attaches the signature to every request.
          let sigParams = "";
          let sigHost   = "";
          try {
            const u = new URL(streamUrl);
            sigHost   = u.hostname;
            sigParams = u.search.startsWith("?") ? u.search.slice(1) : u.search;
          } catch {}

          function addSig(url: string): string {
            if (!sigParams || !sigHost) return url;
            if (!url.includes(sigHost)) return url;
            if (url.includes("Signature=") || url.includes("signature=")) return url;
            return url.includes("?") ? `${url}&${sigParams}` : `${url}?${sigParams}`;
          }

          // Standalone fetch-based loader — intercepts every HLS.js network
          // request (playlists + fragments) and adds the signature before fetching.
          class SignedFetchLoader {
            stats = {
              aborted: false, loaded: 0, retry: 0, total: 0, chunkCount: 0, bwEstimate: 0,
              loading: { start: 0, first: 0, end: 0 },
              parsing:  { start: 0, end: 0 },
              buffering: { start: 0, first: 0, end: 0 },
            };
            private _ctrl: AbortController | null = null;
            constructor(_cfg: any) {}
            destroy() { this.abort(); }
            abort()   { this._ctrl?.abort(); this._ctrl = null; }
            load(context: any, _cfg: any, callbacks: any) {
              const url = addSig(context.url ?? "");
              context.url = url; // keep context in sync
              this._ctrl = new AbortController();
              const t0 = performance.now();
              this.stats.loading.start = t0;
              fetch(url, { signal: this._ctrl.signal })
                .then(async (res) => {
                  if (!res.ok) {
                    callbacks.onError(
                      { code: res.status, text: res.statusText },
                      context, res, this.stats,
                    );
                    return;
                  }
                  this.stats.loading.first = performance.now();
                  const isText = (context.responseType ?? "text") !== "arraybuffer";
                  const data: string | ArrayBuffer = isText
                    ? await res.text()
                    : await res.arrayBuffer();
                  const t2 = performance.now();
                  this.stats.loading.end   = t2;
                  this.stats.loaded = typeof data === "string" ? data.length : data.byteLength;
                  this.stats.total  = this.stats.loaded;
                  callbacks.onSuccess(
                    { url: res.url, data, redirected: res.redirected },
                    this.stats, context, res,
                  );
                })
                .catch((err: any) => {
                  if (err?.name === "AbortError") { this.stats.aborted = true; return; }
                  callbacks.onError({ code: 0, text: err?.message ?? "fetch error" }, context, null, this.stats);
                });
            }
          }

          const hls = new Hls({
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 10,
            maxBufferLength: 60,
            maxMaxBufferLength: 120,
            enableWorker: false,           // keep requests on main thread so our loader runs
            lowLatencyMode: false,
            loader: SignedFetchLoader,     // intercepts ALL requests (playlists + segments)
          });
          hlsRef.current = hls;

          hls.loadSource(streamUrl);
          hls.attachMedia(video);

          await new Promise<void>((resolve, reject) => {
            hls.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
              if (cancelled) return;
              // Build quality list
              const levels: QualityTrack[] = (data.levels ?? [])
                .map((l: any, i: number) => ({ height: l.height || 0, bandwidth: l.bitrate || 0, raw: i }))
                .filter((l: QualityTrack) => l.height > 0)
                .sort((a: QualityTrack, b: QualityTrack) => b.height - a.height);
              setQualities(levels);
              resolve();
            });
            hls.on(Hls.Events.ERROR, (_: any, data: any) => {
              if (data.fatal) reject(new Error(data.details || "HLS error"));
            });
          });

          if (cancelled) return;
          video.play().catch(() => {});
          setStatus("ready");

          hls.on(Hls.Events.ERROR, (_: any, data: any) => {
            if (cancelled) return;
            if (data.fatal) {
              if (data.type === "networkError") {
                // Auto-reconnect
                scheduleReconnect();
              } else {
                setStatus("error");
                setError(data.details || "Fatal stream error");
              }
            }
          });
          return;
        }

        /* ── DASH / Shaka path ── */
        setStatusMsg("Loading player engine…");
        const shakaModule = await import("shaka-player");
        const shaka = (shakaModule as any).default ?? shakaModule;
        if (cancelled) return;

        shaka.polyfill.installAll();

        const player = new shaka.Player();
        await player.attach(video);
        playerRef.current = player;

        // ClearKey DRM
        const shakaKeys: Record<string, string> = {};
        for (const [kid, key] of Object.entries(clearKeys)) {
          if (isHex32(kid) && isHex32(key)) {
            shakaKeys[hexToBase64url(kid)] = hexToBase64url(key);
          }
        }

        player.configure({
          streaming: {
            bufferingGoal: 30,
            rebufferingGoal: 2,
            safeSeekOffset: 3,
            stallEnabled: true,
            retryParameters: {
              maxAttempts: 5,
              baseDelay: 500,
              backoffFactor: 1.5,
              fuzzFactor: 0.5,
              timeout: 20000,
            },
          },
          ...(Object.keys(shakaKeys).length > 0 ? { drm: { clearKeys: shakaKeys } } : {}),
        });

        player.addEventListener("error", (event: Event) => {
          if (cancelled) return;
          const detail = (event as any).detail ?? event;
          const code: number = detail?.code ?? 0;
          // Code 7000-7999 = network errors → reconnect
          if (code >= 7000 && code < 8000) {
            scheduleReconnect();
          } else {
            setStatus("error");
            setError(detail?.message || `Playback error (code ${code})`);
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

        await player.load(streamUrl);
        if (cancelled) return;

        setStatus("ready");
        video.play().catch(() => {});
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
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (playerRef.current) {
        playerRef.current.destroy().catch(() => {});
        playerRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl, attempt]);

  /* ── Auto-reconnect ──────────────────────────────────────────────────── */
  function scheduleReconnect() {
    reconnectCountRef.current += 1;
    const delay = Math.min(2000 * reconnectCountRef.current, 16000);
    setStatusMsg(`Stream interrupted — reconnecting in ${delay / 1000}s…`);
    setStatus("loading");
    reconnectRef.current = setTimeout(() => {
      setAttempt((a) => a + 1);
    }, delay);
  }

  /* ── Video event listeners ───────────────────────────────────────────── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay    = () => { setPlaying(true); setBuffering(false); };
    const onPause   = () => setPlaying(false);
    const onVol     = () => { setVolume(video.volume); setMuted(video.muted); };
    const onWait    = () => setBuffering(true);
    const onCanPlay = () => { setBuffering(false); };
    const onTime    = () => {
      const ct = video.currentTime;
      setCurrentTime(ct);

      // DVR: check seekable range
      if (video.seekable.length > 0) {
        const seekStart = video.seekable.start(0);
        const seekEnd   = video.seekable.end(video.seekable.length - 1);
        const range     = seekEnd - seekStart;
        if (range > 30) {
          setHasDvr(true);
          setDuration(range);
          const offset = seekEnd - ct;
          setDvrOffset(offset);
          setIsAtLive(offset < 8);
        }
      }
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVol);
    video.addEventListener("waiting", onWait);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("timeupdate", onTime);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("volumechange", onVol);
      video.removeEventListener("waiting", onWait);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("timeupdate", onTime);
    };
  }, [status]);

  /* ── Fullscreen ──────────────────────────────────────────────────────── */
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
    const onVideoFS    = () => setFullscreen(true);
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

  /* ── Keyboard shortcuts ──────────────────────────────────────────────── */
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
          if (hasDvr) { e.preventDefault(); skip(10); }
          break;
        case "ArrowLeft": case "j":
          if (hasDvr) { e.preventDefault(); skip(-10); }
          break;
        case "ArrowUp":
          e.preventDefault(); v.volume = Math.min(v.volume + 0.1, 1); break;
        case "ArrowDown":
          e.preventDefault(); v.volume = Math.max(v.volume - 0.1, 0); break;
        case "m": v.muted = !v.muted; break;
        case "f": toggleFullscreen(); break;
        case "e": goToLiveEdge(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, hasDvr, resetHideTimer]);

  /* ── Actions ─────────────────────────────────────────────────────────── */
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

  function goToLiveEdge() {
    const v = videoRef.current;
    if (!v || !v.seekable.length) return;
    v.currentTime = v.seekable.end(v.seekable.length - 1);
    resetHideTimer();
  }

  function skip(secs: number) {
    const v = videoRef.current;
    if (!v || !v.seekable.length) return;
    const seekEnd = v.seekable.end(v.seekable.length - 1);
    const seekStart = v.seekable.start(0);
    v.currentTime = Math.max(seekStart, Math.min(v.currentTime + secs, seekEnd));
    resetHideTimer();
  }

  function selectQuality(height: number | "auto") {
    if (hlsRef.current) {
      if (height === "auto") {
        hlsRef.current.currentLevel = -1;
      } else {
        const idx = qualities.findIndex((q) => q.height === height);
        if (idx !== -1) hlsRef.current.currentLevel = idx;
      }
    } else if (playerRef.current) {
      if (height === "auto") {
        playerRef.current.configure({ abr: { enabled: true } });
      } else {
        playerRef.current.configure({ abr: { enabled: false } });
        const tracks = playerRef.current.getVariantTracks();
        const best = (tracks as any[])
          .filter((t: any) => t.height === height)
          .sort((a: any, b: any) => b.bandwidth - a.bandwidth)[0];
        if (best) playerRef.current.selectVariantTrack(best, true);
      }
    }
    setActiveQuality(height);
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
      if ((video as any).webkitEnterFullscreen) {
        (video as any).webkitEnterFullscreen();
      } else if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if ((el as any).webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
    }
  }

  /* ── DVR seek bar logic ──────────────────────────────────────────────── */
  function getDvrRatio(clientX: number): number | null {
    const bar = seekBarRef.current;
    const v = videoRef.current;
    if (!bar || !v || !v.seekable.length) return null;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
  }

  function seekToRatio(ratio: number) {
    const v = videoRef.current;
    if (!v || !v.seekable.length) return;
    const seekStart = v.seekable.start(0);
    const seekEnd   = v.seekable.end(v.seekable.length - 1);
    v.currentTime = seekStart + ratio * (seekEnd - seekStart);
  }

  function onSeekClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!hasDvr) return;
    const ratio = getDvrRatio(e.clientX);
    if (ratio !== null) { seekToRatio(ratio); resetHideTimer(); }
  }

  function onSeekMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!hasDvr) return;
    const bar = seekBarRef.current;
    const v = videoRef.current;
    if (!bar || !v || !v.seekable.length) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
    const seekStart = v.seekable.start(0);
    const seekEnd   = v.seekable.end(v.seekable.length - 1);
    setSeekTooltip({ time: seekStart + pct * (seekEnd - seekStart), pct });
    if (seeking) seekToRatio(pct);
  }

  function onSeekTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (!hasDvr) return;
    e.stopPropagation();
    touchSeekRef.current = true;
    setSeeking(true);
    const ratio = getDvrRatio(e.touches[0].clientX);
    if (ratio !== null) seekToRatio(ratio);
  }

  function onSeekTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (!hasDvr) return;
    e.stopPropagation();
    const ratio = getDvrRatio(e.touches[0].clientX);
    if (ratio !== null) seekToRatio(ratio);
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
      if (hasDvr) skip(side === "right" ? 10 : -10);
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

  /* ── derived ─────────────────────────────────────────────────────────── */
  const volumeLevel: "off" | "low" | "high" =
    (muted || volume === 0) ? "off" : volume < 0.5 ? "low" : "high";
  const qualityLabel = activeQuality === "auto" ? "Auto" : `${activeQuality}p`;
  const speedLabel   = speed === 1 ? "Normal" : `${speed}x`;

  // DVR progress: fraction through the seekable window
  let dvrPlayed = 0;
  if (hasDvr && videoRef.current?.seekable.length) {
    const v = videoRef.current;
    const seekStart = v.seekable.start(0);
    const seekEnd   = v.seekable.end(v.seekable.length - 1);
    dvrPlayed = (currentTime - seekStart) / Math.max(1, seekEnd - seekStart);
    dvrPlayed = Math.max(0, Math.min(1, dvrPlayed));
  }

  /* ══════════════════════════════════════════════════════════════════════
     Render
  ══════════════════════════════════════════════════════════════════════ */
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
        style={{ opacity: status === "ready" ? 1 : 0, transition: "opacity 0.3s" }}
        playsInline
        preload="auto"
      />

      {/* Loading overlay */}
      {status === "loading" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4"
          style={{ background: "radial-gradient(ellipse at center, #0d1117 0%, #060a10 100%)" }}
        >
          {[160, 260, 360].map((size, i) => (
            <div key={size} className="absolute rounded-full animate-ping"
              style={{
                width: size, height: size,
                border: "1px solid rgba(229,57,53,0.18)",
                animationDuration: `${2 + i * 0.6}s`,
                animationDelay: `${i * 0.4}s`,
              }} />
          ))}
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-[3px] animate-spin"
              style={{ borderColor: "rgba(229,57,53,.12)", borderTopColor: ACCENT, animationDuration: "0.8s" }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #e53935, #ef9a9a)", boxShadow: "0 0 20px rgba(229,57,53,0.5)" }}>
                {/* Signal / broadcast icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M1.5 8.5a13 13 0 0 1 21 0M5.5 12.5a9 9 0 0 1 13 0M9.5 16.5a5 5 0 0 1 5 0M12 20v.5" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
                </svg>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-widest text-white">PW</span>
              <LiveBadge isAtLive={true} />
            </div>
            <div className="text-xs text-white/40 tracking-widest uppercase">{statusMsg}</div>
          </div>
          <div className="w-40 h-0.5 rounded-full overflow-hidden mt-1" style={{ background: "rgba(255,255,255,.08)" }}>
            <div className="h-full w-[60%] rounded-full animate-[shimmer_1.6s_ease-in-out_infinite]"
              style={{ background: "linear-gradient(90deg, transparent, #ef5350, transparent)" }} />
          </div>
        </div>
      )}

      {/* Error overlay */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-5 text-center"
          style={{ background: "rgba(0,0,0,.92)" }}>
          <span className="text-4xl">📡</span>
          <p className="text-sm text-[#ff6584] max-w-xs leading-relaxed">{error}</p>
          <button
            onClick={(e) => { e.stopPropagation(); reconnectCountRef.current = 0; setAttempt((a) => a + 1); }}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-medium"
            style={{ background: ACCENT }}
          >
            <RefreshCw className="w-4 h-4" /> Reconnect
          </button>
        </div>
      )}

      {/* Buffering spinner */}
      {buffering && status === "ready" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[8]">
          <div className="w-10 h-10 rounded-full border-[3px] animate-spin"
            style={{ borderColor: "rgba(229,57,53,.18)", borderTopColor: ACCENT }} />
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
            <Btn onClick={onBack ?? (() => window.history.back())} title="Back">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
              </svg>
            </Btn>
            {title && (
              <div className="flex-1 min-w-0 text-[13px] font-semibold text-white/90 truncate leading-snug ml-1 pr-2">{title}</div>
            )}
            <div className="mr-2 flex-shrink-0">
              <LiveBadge isAtLive={isAtLive} />
            </div>
          </div>

          {/* ── Centre (mobile play/pause) ── */}
          <div className="flex-1 flex items-center justify-center gap-10 pointer-events-none">
            {isMobile && (
              <button
                className="pointer-events-auto flex items-center justify-center border-none bg-transparent cursor-pointer outline-none"
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              >
                <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center"
                  style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(8px)", border: "1.5px solid rgba(255,255,255,.2)" }}>
                  {playing ? (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                      <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
                    </svg>
                  ) : (
                    <div style={{ width: 0, height: 0, borderTop: "12px solid transparent", borderBottom: "12px solid transparent", borderLeft: "20px solid #fff", marginLeft: 4 }} />
                  )}
                </div>
              </button>
            )}
          </div>

          {/* ── Bottom controls ── */}
          <div
            className="flex flex-col gap-1 px-2 pb-2 flex-shrink-0"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,.92) 0%, transparent 100%)" }}
          >
            {/* DVR seek bar (only if DVR available) */}
            {hasDvr && (
              <div className="px-2 py-1 relative">
                {/* Seek tooltip */}
                {seekTooltip && (
                  <div
                    className="absolute bottom-8 text-[11px] text-white px-1.5 py-0.5 rounded pointer-events-none z-10"
                    style={{
                      left: `${seekTooltip.pct * 100}%`,
                      transform: "translateX(-50%)",
                      background: "rgba(0,0,0,.75)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatTime(seekTooltip.time)}
                  </div>
                )}
                <div
                  ref={seekBarRef}
                  className="relative h-1 rounded-full cursor-pointer group"
                  style={{ background: "rgba(255,255,255,.2)" }}
                  onClick={onSeekClick}
                  onMouseMove={onSeekMouseMove}
                  onMouseLeave={() => setSeekTooltip(null)}
                  onMouseDown={(e) => { setSeeking(true); onSeekClick(e); }}
                  onMouseUp={() => setSeeking(false)}
                  onTouchStart={onSeekTouchStart}
                  onTouchMove={onSeekTouchMove}
                  onTouchEnd={onSeekTouchEnd}
                >
                  {/* Played */}
                  <div className="absolute top-0 left-0 h-full rounded-full"
                    style={{ width: `${dvrPlayed * 100}%`, background: ACCENT, transition: seeking ? "none" : "width 0.3s" }} />
                  {/* Thumb */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: `${dvrPlayed * 100}%`, transform: "translate(-50%,-50%)", background: "#fff" }}
                  />
                </div>
              </div>
            )}

            {/* Control row */}
            <div className="flex items-center gap-0.5">
              {/* Play/Pause (desktop) */}
              {!isMobile && (
                <Btn onClick={(e) => { e.stopPropagation(); togglePlay(); }} title={playing ? "Pause" : "Play"}>
                  {playing ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                      <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
                    </svg>
                  ) : (
                    <div style={{ width: 0, height: 0, borderTop: "9px solid transparent", borderBottom: "9px solid transparent", borderLeft: "16px solid #fff", marginLeft: 2 }} />
                  )}
                </Btn>
              )}

              {/* Volume */}
              <Btn onClick={(e) => { e.stopPropagation(); toggleMute(); }} title={muted ? "Unmute" : "Mute"}>
                <VolumeIcon level={volumeLevel} />
              </Btn>
              <input
                type="range" min="0" max="1" step="0.05"
                value={muted ? 0 : volume}
                onChange={(e) => { e.stopPropagation(); setVideoVolume(parseFloat(e.target.value)); }}
                onClick={(e) => e.stopPropagation()}
                className="w-16 sm:w-20 accent-white cursor-pointer"
                style={{ accentColor: "#fff" }}
              />

              {/* DVR offset */}
              {hasDvr && !isAtLive && (
                <span className="text-[11px] text-white/60 ml-1 flex-shrink-0">
                  -{formatTime(dvrOffset)}
                </span>
              )}

              <div className="flex-1" />

              {/* Go to live edge */}
              {!isAtLive && hasDvr && (
                <button
                  onClick={(e) => { e.stopPropagation(); goToLiveEdge(); }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold text-white border-none cursor-pointer mr-1 flex-shrink-0"
                  style={{ background: ACCENT }}
                >
                  ▶ Go Live
                </button>
              )}

              {/* Settings */}
              <div className="relative">
                <Btn
                  onClick={(e) => { e.stopPropagation(); setShowSettings((s) => !s); setSettingsPanel("main"); }}
                  title="Settings"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                </Btn>

                {/* Settings panel */}
                {showSettings && (
                  <div
                    className="absolute bottom-12 right-0 rounded-xl overflow-hidden z-30 w-52"
                    style={{ background: "rgba(18,18,28,.96)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,.12)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {settingsPanel === "main" && (
                      <div className="flex flex-col py-2">
                        <div className="px-4 py-1.5 text-[10px] text-white/40 uppercase tracking-widest font-semibold">Playback</div>
                        <button className="flex items-center justify-between px-4 py-2.5 text-sm text-white hover:bg-white/8 cursor-pointer"
                          onClick={() => setSettingsPanel("speed")}>
                          <span className="text-white/60">Speed</span>
                          <span className="text-[13px] font-medium">{speedLabel} ›</span>
                        </button>
                        {qualities.length > 0 && (
                          <button className="flex items-center justify-between px-4 py-2.5 text-sm text-white hover:bg-white/8 cursor-pointer"
                            onClick={() => setSettingsPanel("quality")}>
                            <span className="text-white/60">Quality</span>
                            <span className="text-[13px] font-medium">{qualityLabel} ›</span>
                          </button>
                        )}
                      </div>
                    )}
                    {settingsPanel === "speed" && (
                      <div className="flex flex-col py-2">
                        <button className="flex items-center gap-2 px-4 py-2 text-sm text-white/60 hover:bg-white/8 cursor-pointer"
                          onClick={() => setSettingsPanel("main")}>
                          ‹ <span>Speed</span>
                        </button>
                        {SPEEDS.map((s) => (
                          <button key={s}
                            className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/8 cursor-pointer"
                            style={{ color: speed === s ? ACCENT : "white" }}
                            onClick={() => setVideoSpeed(s)}>
                            {s === 1 ? "Normal" : `${s}×`}
                            {speed === s && <span style={{ color: ACCENT }}>✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {settingsPanel === "quality" && (
                      <div className="flex flex-col py-2">
                        <button className="flex items-center gap-2 px-4 py-2 text-sm text-white/60 hover:bg-white/8 cursor-pointer"
                          onClick={() => setSettingsPanel("main")}>
                          ‹ <span>Quality</span>
                        </button>
                        <button
                          className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/8 cursor-pointer"
                          style={{ color: activeQuality === "auto" ? ACCENT : "white" }}
                          onClick={() => selectQuality("auto")}>
                          Auto {activeQuality === "auto" && <span style={{ color: ACCENT }}>✓</span>}
                        </button>
                        {qualities.map((q) => (
                          <button key={q.height}
                            className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/8 cursor-pointer"
                            style={{ color: activeQuality === q.height ? ACCENT : "white" }}
                            onClick={() => selectQuality(q.height)}>
                            {q.height}p
                            {activeQuality === q.height && <span style={{ color: ACCENT }}>✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Fullscreen */}
              <Btn onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
                {fullscreen ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                  </svg>
                )}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
