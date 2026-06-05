import { useEffect, useRef, useState, useCallback } from "react";
import {
  AlertCircle, RefreshCw, Play, Pause, Volume2, VolumeX,
  Maximize, Minimize, SkipForward, SkipBack, Settings,
  ChevronRight, Bookmark, BookmarkCheck, Trash2, X,
  PictureInPicture2, Keyboard,
} from "lucide-react";

import { apiUrl } from "@/lib/apiUrl";

const API_BASE = "https://learnbyakp.onrender.com/api/pw";
const PROXY_BASE = apiUrl("/api");

interface DrmCache { mpdUrl: string; kid: string; keyHex: string; }
const drmCache = new Map<string, DrmCache>();

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
const bmKey = (id: string) => `pw-bookmarks-${id}`;
function loadBookmarks(id: string): BookmarkEntry[] {
  try { return JSON.parse(localStorage.getItem(bmKey(id)) || "[]"); } catch { return []; }
}
function saveBookmarks(id: string, bms: BookmarkEntry[]) {
  localStorage.setItem(bmKey(id), JSON.stringify(bms));
}

interface BookmarkEntry { id: string; time: number; label: string; }
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
}

export function DrmPlayer({ batchId, subjectId, childId, poster, title }: DrmPlayerProps) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const playerRef     = useRef<any>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const seekBarRef    = useRef<HTMLDivElement>(null);
  const hideTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTapRef    = useRef<{ time: number; x: number } | null>(null);
  const touchSeekRef  = useRef(false);

  const [status, setStatus]         = useState<Status>("loading");
  const [statusMsg, setStatusMsg]   = useState("Fetching video info…");
  const [error, setError]           = useState("");
  const [attempt, setAttempt]       = useState(0);

  const [playing, setPlaying]               = useState(false);
  const [currentTime, setCurrentTime]       = useState(0);
  const [duration, setDuration]             = useState(0);
  const [buffered, setBuffered]             = useState(0);
  const [volume, setVolume]                 = useState(1);
  const [muted, setMuted]                   = useState(false);
  const [speed, setSpeed]                   = useState(1);
  const [fullscreen, setFullscreen]         = useState(false);
  const [isPiP, setIsPiP]                   = useState(false);
  const [showControls, setShowControls]     = useState(true);
  const [showSettings, setShowSettings]     = useState(false);
  const [settingsPanel, setSettingsPanel]   = useState<SettingsPanel>("main");
  const [seeking, setSeeking]               = useState(false);
  const [skipFlash, setSkipFlash]           = useState<null | { dir: "fwd" | "bwd"; key: number }>(null);
  const [volumeVisible, setVolumeVisible]   = useState(false);
  const [showBookmarks, setShowBookmarks]   = useState(false);
  const [bookmarks, setBookmarks]           = useState<BookmarkEntry[]>([]);
  const [editingBm, setEditingBm]           = useState<string | null>(null);
  const [editLabel, setEditLabel]           = useState("");
  const [qualities, setQualities]           = useState<QualityTrack[]>([]);
  const [activeQuality, setActiveQuality]   = useState<number | "auto">("auto");
  const [showShortcuts, setShowShortcuts]   = useState(false);
  const [seekTooltip, setSeekTooltip]       = useState<{ time: number; pct: number } | null>(null);
  const [doubleTapFlash, setDoubleTapFlash] = useState<null | { dir: "left" | "right"; key: number }>(null);
  const [isMobile, setIsMobile]             = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (childId) setBookmarks(loadBookmarks(childId));
  }, [childId]);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
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
          setStatusMsg("Fetching video URL…");
          const urlRes = await fetch(
            `${API_BASE}/video-url-details?batchId=${encodeURIComponent(batchId)}&childId=${encodeURIComponent(childId)}&subjectId=${encodeURIComponent(subjectId)}`
          );
          if (!urlRes.ok) throw new Error(`video-url-details failed (${urlRes.status})`);
          const urlData = await urlRes.json();
          const mpdUrl: string | undefined = urlData?.data?.[0]?.url;
          if (!mpdUrl) throw new Error("No MPD URL returned from server");

          if (cancelled) return;
          setStatusMsg("Extracting encryption key…");
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
        player.configure({ drm: { clearKeys: { [kidB64]: keyB64 } } });

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
          // Restore resume position
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

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime     = () => setCurrentTime(video.currentTime);
    const onDur      = () => setDuration(video.duration);
    const onPlay     = () => setPlaying(true);
    const onPause    = () => setPlaying(false);
    const onVol      = () => { setVolume(video.volume); setMuted(video.muted); };
    const onProgress = () => {
      if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1));
    };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("durationchange", onDur);
    video.addEventListener("loadedmetadata", onDur);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVol);
    video.addEventListener("progress", onProgress);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("durationchange", onDur);
      video.removeEventListener("loadedmetadata", onDur);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("volumechange", onVol);
      video.removeEventListener("progress", onProgress);
    };
  }, [status]);

  // Auto-save resume position every 5s
  useEffect(() => {
    if (status !== "ready") return;
    resumeSaveRef.current = setInterval(() => {
      const v = videoRef.current;
      if (v && v.currentTime > 2) {
        try { localStorage.setItem(RESUME_KEY(childId), String(v.currentTime)); } catch {}
      }
    }, 5000);
    return () => {
      if (resumeSaveRef.current) clearInterval(resumeSaveRef.current);
    };
  }, [status, childId]);

  // Fullscreen / PiP events
  useEffect(() => {
    const onFS  = () => setFullscreen(!!document.fullscreenElement);
    const onPiP = () => setIsPiP(!!document.pictureInPictureElement);
    document.addEventListener("fullscreenchange", onFS);
    document.addEventListener("enterpictureinpicture", onPiP);
    document.addEventListener("leavepictureinpicture", onPiP);
    return () => {
      document.removeEventListener("fullscreenchange", onFS);
      document.removeEventListener("enterpictureinpicture", onPiP);
      document.removeEventListener("leavepictureinpicture", onPiP);
    };
  }, []);

  // Keyboard shortcuts
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
          e.preventDefault(); v.currentTime = Math.min(v.currentTime + 10, v.duration);
          setSkipFlash({ dir: "fwd", key: Date.now() }); resetHideTimer(); break;
        case "ArrowLeft": case "j":
          e.preventDefault(); v.currentTime = Math.max(v.currentTime - 10, 0);
          setSkipFlash({ dir: "bwd", key: Date.now() }); resetHideTimer(); break;
        case "ArrowUp":
          e.preventDefault(); v.volume = Math.min(v.volume + 0.1, 1); break;
        case "ArrowDown":
          e.preventDefault(); v.volume = Math.max(v.volume - 0.1, 0); break;
        case "m": v.muted = !v.muted; break;
        case "f": toggleFullscreen(); break;
        case "p": togglePiP(); break;
        case "b": addBookmark(); break;
        case "?": setShowShortcuts((s) => !s); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function togglePiP() {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if ((document as any).pictureInPictureEnabled) await v.requestPictureInPicture();
    } catch {}
  }

  function skip(secs: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.currentTime + secs, v.duration));
    setSkipFlash({ dir: secs > 0 ? "fwd" : "bwd", key: Date.now() });
    resetHideTimer();
  }

  // ── Seekbar: mouse ──
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

  // ── Seekbar: touch ──
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

  // ── Touch gestures on video ──
  function handleTap(e: React.TouchEvent<HTMLDivElement>) {
    if (touchSeekRef.current) return;
    e.preventDefault();
    const now = Date.now();
    const touch = e.changedTouches[0];
    const rect = containerRef.current!.getBoundingClientRect();
    const relX = touch.clientX - rect.left;

    if (lastTapRef.current && now - lastTapRef.current.time < 280) {
      // Double tap
      const side = relX < rect.width / 2 ? "left" : "right";
      skip(side === "right" ? 10 : -10);
      setDoubleTapFlash({ dir: side, key: Date.now() });
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { time: now, x: relX };
      // Delay to distinguish single vs double
      setTimeout(() => {
        if (lastTapRef.current && Date.now() - lastTapRef.current.time >= 280) {
          // Single tap — toggle controls
          setShowControls((v) => {
            if (!v) resetHideTimer();
            return !v;
          });
          lastTapRef.current = null;
        }
      }, 300);
    }
  }

  // ── Bookmarks ──
  function addBookmark() {
    const v = videoRef.current;
    if (!v || !childId) return;
    const entry: BookmarkEntry = {
      id: Date.now().toString(),
      time: v.currentTime,
      label: `Bookmark at ${formatTime(v.currentTime)}`,
    };
    const updated = [...bookmarks, entry].sort((a, b) => a.time - b.time);
    setBookmarks(updated);
    saveBookmarks(childId, updated);
  }

  function deleteBookmark(id: string) {
    const updated = bookmarks.filter((b) => b.id !== id);
    setBookmarks(updated);
    saveBookmarks(childId, updated);
  }

  function saveLabel(id: string) {
    const updated = bookmarks.map((b) => b.id === id ? { ...b, label: editLabel || b.label } : b);
    setBookmarks(updated);
    saveBookmarks(childId, updated);
    setEditingBm(null);
  }

  function jumpTo(time: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = time;
    resetHideTimer();
  }

  const played = duration ? currentTime / duration : 0;
  const buf    = duration ? buffered / duration : 0;
  const qualityLabel = activeQuality === "auto" ? "Auto" : `${activeQuality}p`;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black select-none overflow-hidden"
      onMouseMove={resetHideTimer}
      onMouseLeave={() => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); setShowControls(false); }}
      onClick={(e) => { if (status === "ready" && !isMobile) { e.stopPropagation(); togglePlay(); } }}
      onTouchEnd={status === "ready" ? handleTap : undefined}
    >
      <video
        ref={videoRef}
        poster={poster}
        className="w-full h-full object-contain"
        style={{ opacity: status === "ready" ? 1 : 0, transition: "opacity 0.3s" }}
        playsInline
      />

      {/* Loading / Decrypting */}
      {(status === "loading" || status === "decrypting") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 border-zinc-700 border-t-primary animate-spin" />
          <span className="text-xs sm:text-sm text-zinc-300 font-medium mt-2 text-center px-4">{statusMsg}</span>
          {status === "decrypting" && (
            <span className="text-[10px] sm:text-[11px] text-zinc-500">Setting up DRM playback…</span>
          )}
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4">
          <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-red-500" />
          <p className="text-zinc-300 text-xs sm:text-sm text-center max-w-xs">{error}</p>
          <button
            onClick={(e) => { e.stopPropagation(); setAttempt((a) => a + 1); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-black text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Skip flash */}
      {skipFlash && <SkipFlash key={skipFlash.key} dir={skipFlash.dir} />}

      {/* Double tap flash */}
      {doubleTapFlash && <DoubleTapFlash key={doubleTapFlash.key} dir={doubleTapFlash.dir} />}

      {status === "ready" && (
        <>
          {/* Center play/pause indicator */}
          <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 pointer-events-none ${!playing ? "opacity-100" : "opacity-0"}`}>
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <Play className="w-6 h-6 sm:w-7 sm:h-7 text-white fill-white ml-1" />
            </div>
          </div>

          {/* Title overlay (top) */}
          {title && (
            <div className={`absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 to-transparent pt-3 pb-8 px-4 transition-opacity duration-300 pointer-events-none ${showControls || !playing ? "opacity-100" : "opacity-0"}`}>
              <p className="text-sm font-semibold text-white truncate max-w-[70%]">{title}</p>
            </div>
          )}

          {/* Bookmarks Panel */}
          <div
            className={`absolute top-0 right-0 h-full w-64 sm:w-72 bg-zinc-950/95 backdrop-blur-md border-l border-zinc-800 flex flex-col z-40 transition-transform duration-300 ${showBookmarks ? "translate-x-0" : "translate-x-full"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <BookmarkCheck className="w-4 h-4 text-primary" />
                Timestamps
              </span>
              <button onClick={() => setShowBookmarks(false)} className="text-zinc-400 hover:text-white transition-colors p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={addBookmark}
              className="mx-3 mt-3 flex items-center justify-center gap-2 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-sm font-medium transition-colors"
            >
              <Bookmark className="w-4 h-4" />
              Add at {formatTime(currentTime)}
            </button>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 mt-2">
              {bookmarks.length === 0 ? (
                <div className="text-center py-12 text-zinc-600 text-sm">
                  <Bookmark className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  No bookmarks yet.<br />
                  Press <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono text-zinc-400">B</kbd> to add one.
                </div>
              ) : (
                bookmarks.map((bm) => (
                  <div key={bm.id} className="group flex items-start gap-2 p-2.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
                    <button
                      className="flex-shrink-0 mt-0.5 bg-primary/20 text-primary text-xs font-mono px-2 py-1 rounded-md hover:bg-primary hover:text-black transition-colors"
                      onClick={() => jumpTo(bm.time)}
                    >
                      {formatTime(bm.time)}
                    </button>
                    <div className="flex-1 min-w-0">
                      {editingBm === bm.id ? (
                        <input
                          autoFocus
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          onBlur={() => saveLabel(bm.id)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveLabel(bm.id); if (e.key === "Escape") setEditingBm(null); }}
                          className="w-full bg-zinc-700 text-white text-xs px-2 py-1 rounded outline-none border border-primary/50 focus:border-primary"
                        />
                      ) : (
                        <p className="text-xs text-zinc-200 truncate cursor-pointer hover:text-white" onClick={() => { setEditingBm(bm.id); setEditLabel(bm.label); }} title="Click to rename">
                          {bm.label}
                        </p>
                      )}
                    </div>
                    <button className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all" onClick={() => deleteBookmark(bm.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bookmark dots on seekbar */}
          {duration > 0 && bookmarks.map((bm) => (
            <div
              key={bm.id}
              className="absolute bottom-[52px] sm:bottom-[56px] w-2 h-2 rounded-full bg-primary border border-black -translate-x-1/2 cursor-pointer z-10 hover:scale-150 transition-transform"
              style={{ left: `calc(${((bm.time / duration) * 100).toFixed(2)}% + 16px)` }}
              title={bm.label}
              onClick={(e) => { e.stopPropagation(); jumpTo(bm.time); }}
            />
          ))}

          {/* Keyboard shortcuts modal */}
          {showShortcuts && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50" onClick={(e) => { e.stopPropagation(); setShowShortcuts(false); }}>
              <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 w-72 sm:w-80" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-semibold text-white flex items-center gap-2">
                    <Keyboard className="w-4 h-4 text-primary" />
                    Keyboard Shortcuts
                  </span>
                  <button onClick={() => setShowShortcuts(false)} className="text-zinc-400 hover:text-white p-1"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-2 text-sm text-zinc-300">
                  {[
                    ["Space / K", "Play / Pause"],
                    ["← / J", "Rewind 10s"],
                    ["→ / L", "Forward 10s"],
                    ["↑ / ↓", "Volume"],
                    ["M", "Mute"],
                    ["F", "Fullscreen"],
                    ["P", "Picture in Picture"],
                    ["B", "Add Bookmark"],
                    ["?", "Show shortcuts"],
                  ].map(([key, desc]) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <kbd className="bg-zinc-800 px-2 py-0.5 rounded text-xs font-mono text-zinc-300 whitespace-nowrap">{key}</kbd>
                      <span className="text-zinc-400 text-xs">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Controls overlay */}
          <div
            className={`absolute inset-x-0 bottom-0 transition-opacity duration-300 ${showControls || !playing ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-24 sm:h-28 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none" />

            <div className="absolute bottom-0 inset-x-0 px-3 sm:px-4 pb-3 sm:pb-4 space-y-1.5 sm:space-y-2">

              {/* Seek bar */}
              <div className="relative group"
                onMouseLeave={() => setSeekTooltip(null)}
              >
                {/* Time tooltip */}
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
                  className="relative h-1.5 hover:h-3 bg-white/20 rounded-full cursor-pointer transition-all duration-150"
                  onClick={onSeekClick}
                  onMouseDown={() => setSeeking(true)}
                  onMouseUp={() => { setSeeking(false); setSeekTooltip(null); }}
                  onMouseMove={onSeekMouseMove}
                  onTouchStart={onSeekTouchStart}
                  onTouchMove={onSeekTouchMove}
                  onTouchEnd={onSeekTouchEnd}
                >
                  <div className="absolute inset-y-0 left-0 bg-white/30 rounded-full" style={{ width: `${buf * 100}%` }} />
                  <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: `${played * 100}%` }} />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2"
                    style={{ left: `${played * 100}%` }}
                  />
                </div>
              </div>

              {/* Bottom controls row */}
              <div className="flex items-center justify-between gap-1 sm:gap-2">

                {/* Left */}
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <Btn onClick={() => skip(-10)} title="Rewind 10s (←)">
                    <SkipBack className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  </Btn>
                  <Btn onClick={togglePlay} title={playing ? "Pause (k)" : "Play (k)"}>
                    {playing
                      ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-white" />
                      : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white ml-0.5" />}
                  </Btn>
                  <Btn onClick={() => skip(10)} title="Forward 10s (→)">
                    <SkipForward className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  </Btn>

                  {/* Volume (hidden on small mobile) */}
                  <div
                    className="hidden sm:flex items-center gap-1"
                    onMouseEnter={() => setVolumeVisible(true)}
                    onMouseLeave={() => setVolumeVisible(false)}
                  >
                    <Btn onClick={toggleMute} title="Mute (m)">
                      {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Btn>
                    <div className={`overflow-hidden transition-all duration-200 ${volumeVisible ? "w-20 opacity-100" : "w-0 opacity-0"}`}>
                      <input
                        type="range" min={0} max={1} step={0.05}
                        value={muted ? 0 : volume}
                        onChange={(e) => setVideoVolume(parseFloat(e.target.value))}
                        className="w-20 h-1 accent-primary cursor-pointer"
                      />
                    </div>
                  </div>

                  <span className="text-[10px] sm:text-xs text-zinc-300 tabular-nums ml-0.5 sm:ml-1 whitespace-nowrap">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                {/* Right */}
                <div className="flex items-center gap-0.5 sm:gap-1">
                  {/* Speed badge shortcut on mobile */}
                  {isMobile && speed !== 1 && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{speed}×</span>
                  )}

                  {/* Bookmarks */}
                  <Btn onClick={() => setShowBookmarks((v) => !v)} title="Bookmarks (b)">
                    {bookmarks.length > 0
                      ? <BookmarkCheck className={`w-4 h-4 ${showBookmarks ? "text-primary" : ""}`} />
                      : <Bookmark className={`w-4 h-4 ${showBookmarks ? "text-primary" : ""}`} />}
                  </Btn>
                  {bookmarks.length > 0 && (
                    <span className="text-[10px] text-primary font-bold -ml-1 mr-0.5 hidden sm:inline">{bookmarks.length}</span>
                  )}

                  {/* Shortcuts help (desktop) */}
                  <Btn onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (?)">
                    <Keyboard className="w-4 h-4 hidden sm:block" />
                  </Btn>

                  {/* PiP */}
                  {(document as any).pictureInPictureEnabled && (
                    <Btn onClick={togglePiP} title="Picture in Picture (p)">
                      <PictureInPicture2 className={`w-4 h-4 ${isPiP ? "text-primary" : ""}`} />
                    </Btn>
                  )}

                  {/* Settings */}
                  <div className="relative">
                    <Btn
                      onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); setSettingsPanel("main"); }}
                      title="Settings"
                    >
                      <Settings className={`w-4 h-4 transition-transform duration-300 ${showSettings ? "rotate-45" : ""}`} />
                    </Btn>

                    {showSettings && (
                      <div
                        className="absolute bottom-10 right-0 w-48 sm:w-52 bg-zinc-900/97 backdrop-blur-md rounded-xl border border-zinc-700/60 shadow-2xl overflow-hidden z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-700/50">
                          {settingsPanel !== "main" && (
                            <button className="text-zinc-400 hover:text-white transition-colors" onClick={() => setSettingsPanel("main")}>
                              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                            </button>
                          )}
                          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                            {settingsPanel === "main" ? "Settings" : settingsPanel === "speed" ? "Speed" : "Quality"}
                          </p>
                        </div>

                        {settingsPanel === "main" && (
                          <div>
                            <button className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-zinc-800/80 transition-colors text-sm text-zinc-200" onClick={() => setSettingsPanel("speed")}>
                              <span>Speed</span>
                              <span className="flex items-center gap-1 text-primary text-xs font-semibold">{speed === 1 ? "Normal" : `${speed}×`}<ChevronRight className="w-3.5 h-3.5" /></span>
                            </button>
                            <button className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-zinc-800/80 transition-colors text-sm text-zinc-200 border-t border-zinc-800" onClick={() => setSettingsPanel("quality")}>
                              <span>Quality</span>
                              <span className="flex items-center gap-1 text-primary text-xs font-semibold">{qualities.length === 0 ? "Loading…" : qualityLabel}<ChevronRight className="w-3.5 h-3.5" /></span>
                            </button>
                          </div>
                        )}

                        {settingsPanel === "speed" && (
                          <div className="max-h-52 overflow-y-auto">
                            {SPEEDS.map((s) => (
                              <button key={s} className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${speed === s ? "text-primary font-semibold bg-primary/10" : "text-zinc-200 hover:bg-zinc-800/80"}`} onClick={() => setVideoSpeed(s)}>
                                {s === 1 ? "Normal" : `${s}×`}
                                {speed === s && <span className="text-primary">✓</span>}
                              </button>
                            ))}
                          </div>
                        )}

                        {settingsPanel === "quality" && (
                          <div className="max-h-52 overflow-y-auto">
                            <button className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${activeQuality === "auto" ? "text-primary font-semibold bg-primary/10" : "text-zinc-200 hover:bg-zinc-800/80"}`} onClick={() => selectQuality("auto")}>
                              <span>Auto</span>
                              {activeQuality === "auto" && <span className="text-primary">✓</span>}
                            </button>
                            {qualities.length === 0 && <div className="px-4 py-3 text-xs text-zinc-500 text-center">Detecting streams…</div>}
                            {qualities.map((q) => (
                              <button key={q.height} className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${activeQuality === q.height ? "text-primary font-semibold bg-primary/10" : "text-zinc-200 hover:bg-zinc-800/80"}`} onClick={() => selectQuality(q.height)}>
                                <span className="flex items-center gap-2">
                                  {q.height}p
                                  {q.height >= 1080 && <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 rounded font-bold">FHD</span>}
                                  {q.height >= 720 && q.height < 1080 && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 rounded font-bold">HD</span>}
                                </span>
                                {activeQuality === q.height && <span className="text-primary">✓</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <Btn onClick={toggleFullscreen} title="Fullscreen (f)">
                    {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </Btn>
                </div>
              </div>
            </div>
          </div>

          {/* Speed / Quality badge (top-right) */}
          {(speed !== 1 || activeQuality !== "auto") && !isMobile && (
            <div className="absolute top-4 right-4 flex items-center gap-1.5 pointer-events-none">
              {speed !== 1 && <span className="text-xs font-bold text-primary bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">{speed}×</span>}
              {activeQuality !== "auto" && <span className="text-xs font-bold text-white bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">{activeQuality}p</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Btn({ onClick, title, children }: { onClick?: (e: React.MouseEvent) => void; title?: string; children: React.ReactNode; }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg text-white/90 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors touch-manipulation"
    >
      {children}
    </button>
  );
}

function SkipFlash({ dir }: { dir: "fwd" | "bwd" }) {
  return (
    <div className={`absolute inset-y-0 ${dir === "fwd" ? "right-0 left-1/2" : "left-0 right-1/2"} flex items-center justify-center pointer-events-none animate-fade-out`}>
      <div className="flex flex-col items-center gap-1 text-white">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
          {dir === "fwd" ? <SkipForward className="w-6 h-6 sm:w-7 sm:h-7 fill-white" /> : <SkipBack className="w-6 h-6 sm:w-7 sm:h-7 fill-white" />}
        </div>
        <span className="text-xs font-semibold drop-shadow">10s</span>
      </div>
    </div>
  );
}

function DoubleTapFlash({ dir }: { dir: "left" | "right" }) {
  return (
    <div className={`absolute inset-y-0 ${dir === "right" ? "right-0 left-1/2" : "left-0 right-1/2"} flex items-center justify-center pointer-events-none animate-fade-out`}>
      <div className="flex flex-col items-center gap-1.5">
        <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
          {dir === "right" ? <SkipForward className="w-8 h-8 fill-white text-white" /> : <SkipBack className="w-8 h-8 fill-white text-white" />}
        </div>
        <span className="text-xs font-bold text-white drop-shadow-lg bg-black/40 px-2 py-0.5 rounded-full">
          {dir === "right" ? "+10s" : "-10s"}
        </span>
      </div>
    </div>
  );
}
