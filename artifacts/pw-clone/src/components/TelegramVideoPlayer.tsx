import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Download,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Zap,
  Bot,
  Play,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  Settings2,
  Layers,
  FileText,
} from "lucide-react";
import {
  VideoQuality,
  TelegramExtractResponse,
  QUALITY_OPTIONS,
  getNextLowerQuality,
  fetchTelegramVideo,
  resolvePlayableStreamUrl,
  formatBytes,
  normalizeTelegramParam,
} from "@/lib/telegramVideoApi";

export interface TelegramVideoPlayerProps {
  /**
   * Telegram bot URL (e.g. https://t.me/AS_MultiverseRoBot?start=698ad3519549b300a5e1cc6a_6a928fc593ae187d25d4bc13)
   * or direct start parameter (e.g. 698ad3519549b300a5e1cc6a_6a928fc593ae187d25d4bc13).
   */
  videoUrl?: string;
  batchId?: string;
  childId?: string;
  initialQuality?: VideoQuality;
  title?: string;
  poster?: string;
  autoPlay?: boolean;
  onBackToNative?: () => void;
  attachments?: { name: string; url: string }[];
  onOpenSlides?: () => void;
  className?: string;
}

export function TelegramVideoPlayer({
  videoUrl: propVideoUrl,
  batchId,
  childId,
  initialQuality = "720p",
  title: fallbackTitle,
  poster,
  autoPlay = true,
  onBackToNative,
  attachments,
  onOpenSlides,
  className = "",
}: TelegramVideoPlayerProps) {
  // Determine effective starting input (URL or batchId_childId)
  const defaultTarget =
    propVideoUrl ||
    (batchId && childId
      ? `https://t.me/AS_MultiverseRoBot?start=${batchId.trim()}_${childId.trim()}`
      : "") ||
    "https://t.me/AS_MultiverseRoBot?start=698ad3519549b300a5e1cc6a_6a928fc593ae187d25d4bc13";

  const [inputUrl, setInputUrl] = useState<string>(defaultTarget);
  const [activeUrl, setActiveUrl] = useState<string>(defaultTarget);
  const [quality, setQuality] = useState<VideoQuality>(initialQuality);

  const [videoData, setVideoData] = useState<TelegramExtractResponse | null>(null);
  const [playableSrc, setPlayableSrc] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [is404, setIs404] = useState<boolean>(false);

  const [autoFallback, setAutoFallback] = useState<boolean>(true);
  const [fallbackCountdown, setFallbackCountdown] = useState<number | null>(null);

  // Video element and playback timestamp tracking across quality changes
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const savedTimestampRef = useRef<number>(0);
  const wasPlayingRef = useRef<boolean>(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);

  // Sync if propVideoUrl or batchId/childId changes
  useEffect(() => {
    const updated =
      propVideoUrl ||
      (batchId && childId
        ? `https://t.me/AS_MultiverseRoBot?start=${batchId.trim()}_${childId.trim()}`
        : "");
    if (updated && updated !== activeUrl) {
      setInputUrl(updated);
      setActiveUrl(updated);
    }
  }, [propVideoUrl, batchId, childId]);

  // Main extraction function
  const loadVideoStream = useCallback(
    async (targetUrl: string, targetQuality: VideoQuality, preserveTime = false) => {
      if (!targetUrl.trim()) return;

      // Preserve current playback state if switching quality
      if (preserveTime && videoRef.current) {
        savedTimestampRef.current = videoRef.current.currentTime || 0;
        wasPlayingRef.current = !videoRef.current.paused;
      }

      // Cancel any ongoing fetch
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Reset error states
      setErrorMsg(null);
      setIs404(false);
      setFallbackCountdown(null);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      setIsLoading(true);
      setElapsedTime(0);
      const startTime = Date.now();
      timerIntervalRef.current = setInterval(() => {
        setElapsedTime(Number(((Date.now() - startTime) / 1000).toFixed(1)));
      }, 100);

      try {
        const data = await fetchTelegramVideo({
          url: targetUrl,
          quality: targetQuality,
          signal: controller.signal,
        });

        clearInterval(timerIntervalRef.current);
        setVideoData(data);
        const resolved = resolvePlayableStreamUrl(data);
        setPlayableSrc(resolved);
        setIsLoading(false);
      } catch (err: any) {
        clearInterval(timerIntervalRef.current);
        if (err?.name === "AbortError") return;

        setIsLoading(false);
        const isNotFound = err?.is404 || err?.status === 404;
        setIs404(isNotFound);

        if (isNotFound) {
          const friendly =
            "This video is currently not available in the database for the selected quality. Please try another quality.";
          setErrorMsg(friendly);

          // Automatic fallback to next lower quality if enabled
          const nextQuality = getNextLowerQuality(targetQuality);
          if (autoFallback && nextQuality) {
            let cd = 2;
            setFallbackCountdown(cd);
            countdownIntervalRef.current = setInterval(() => {
              cd -= 1;
              if (cd <= 0) {
                clearInterval(countdownIntervalRef.current);
                setFallbackCountdown(null);
                setQuality(nextQuality);
                loadVideoStream(targetUrl, nextQuality, true);
              } else {
                setFallbackCountdown(cd);
              }
            }, 1000);
          }
        } else {
          setErrorMsg(err?.message || "Failed to load video stream from Telegram service.");
        }
      }
    },
    [autoFallback]
  );

  // Trigger load when activeUrl or quality changes
  useEffect(() => {
    if (activeUrl) {
      loadVideoStream(activeUrl, quality, false);
    }
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [activeUrl]);

  // Quality switch handler (preserves timestamp & resumes)
  const handleQualityChange = (newQuality: VideoQuality) => {
    if (newQuality === quality && !errorMsg) return;
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setFallbackCountdown(null);
    setQuality(newQuality);
    loadVideoStream(activeUrl, newQuality, true);
  };

  // When new video src is loaded into video tag, restore timestamp and resume
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      if (savedTimestampRef.current > 0) {
        videoRef.current.currentTime = savedTimestampRef.current;
      }
      if (autoPlay || wasPlayingRef.current) {
        videoRef.current.play().catch(() => {
          // Autoplay policy prevented playback, controls remain available
        });
      }
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUrl.trim()) {
      setActiveUrl(inputUrl.trim());
    }
  };

  const nextLower = getNextLowerQuality(quality);
  const displayTitle =
    videoData?.title || fallbackTitle || "Telegram Stream Lecture";
  const displaySize = formatBytes(videoData?.file_size);

  return (
    <div
      className={`relative w-full h-full bg-[#0a0a0f] text-white flex flex-col select-none overflow-hidden ${className}`}
      style={{ fontFamily: "'DM Sans', -apple-system, sans-serif" }}
    >
      {/* ── Top Header Bar ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-950/95 border-b border-zinc-800/80 z-20 gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {onBackToNative && (
            <button
              onClick={onBackToNative}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
              title="Switch to Native CloudFront Player"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Native Player</span>
            </button>
          )}

          <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate">
                {displayTitle}
              </h2>
              {videoData?.cached && (
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Zap className="w-3 h-3" />
                  Instant Cache
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 truncate">
              Telegram Auto-Resolver (videos.pwxstudy.site)
              {displaySize ? ` • ${displaySize}` : ""}
            </p>
          </div>
        </div>

        {/* Action Buttons in Header */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenSlides && (
            <button
              onClick={onOpenSlides}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
              title="Open Slides Timeline"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">Slides</span>
            </button>
          )}

          {attachments && attachments.length > 0 && (
            <a
              href={attachments[0].url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
              title={attachments[0].name || "Download Notes"}
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Notes</span>
            </a>
          )}

          {videoData?.direct_download_url && (
            <a
              href={videoData.direct_download_url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-violet-600/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Video</span>
              {displaySize && (
                <span className="text-[10px] opacity-80 font-normal">
                  ({displaySize})
                </span>
              )}
            </a>
          )}

          {videoData?.watch_url && (
            <a
              href={videoData.watch_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
              title="Open external watch page"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Web Link</span>
            </a>
          )}
        </div>
      </div>

      {/* ── Main Player Area ──────────────────────────────────────── */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[300px]">
        {/* HTML5 Native Video Player */}
        {playableSrc && !isLoading && !errorMsg && (
          <video
            ref={videoRef}
            src={playableSrc}
            poster={poster}
            controls
            autoPlay={autoPlay}
            playsInline
            onLoadedMetadata={handleLoadedMetadata}
            className="w-full h-full object-contain outline-none bg-black"
          />
        )}

        {/* ── Loading Skeleton / Spinner State ─────────────────────── */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950/90 z-20 px-6 text-center">
            <div className="relative flex items-center justify-center">
              {/* Rotating outer ring */}
              <div className="w-16 h-16 rounded-full border-2 border-sky-500/20 border-t-sky-400 animate-spin" />
              <Bot className="w-6 h-6 text-sky-400 absolute animate-pulse" />
            </div>

            <div className="space-y-1.5 max-w-sm">
              <p className="text-sm font-semibold text-white">
                Resolving video stream from Telegram...
              </p>
              <p className="text-xs text-zinc-400">
                Quality: <span className="text-sky-400 font-mono">{quality}</span>
                {elapsedTime > 0 && ` • Elapsed: ${elapsedTime}s`}
              </p>
              <p className="text-[11px] text-zinc-500">
                Cached requests return in &lt;30ms; fresh extractions take 5–8 seconds.
              </p>
            </div>
          </div>
        )}

        {/* ── Error / 404 State ────────────────────────────────────── */}
        {errorMsg && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950/95 z-20 px-6 text-center overflow-y-auto py-8">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg ${
                is404
                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                  : "bg-red-500/10 border border-red-500/20 text-red-400"
              }`}
            >
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="max-w-md space-y-2">
              <h3 className="text-base font-semibold text-white">
                {is404 ? "Quality Not Available" : "Extraction Issue"}
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">{errorMsg}</p>

              {fallbackCountdown !== null && nextLower && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs mt-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>
                    Auto-switching to {nextLower} in {fallbackCountdown}s...
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
              {nextLower && (
                <button
                  onClick={() => handleQualityChange(nextLower)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold bg-sky-600 hover:bg-sky-500 transition-colors shadow-lg shadow-sky-600/20"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Try {nextLower} Now</span>
                </button>
              )}

              <button
                onClick={() => loadVideoStream(activeUrl, quality, false)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-zinc-300 hover:text-white text-xs font-medium bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry {quality}</span>
              </button>

              {onBackToNative && (
                <button
                  onClick={onBackToNative}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-zinc-300 hover:text-white text-xs font-medium bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Switch to Native Player</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Controls Bar ───────────────────────────────────── */}
      <div className="px-4 py-3 bg-zinc-950 border-t border-zinc-800/80 z-20 flex flex-wrap items-center justify-between gap-3">
        {/* Quality Switcher Pills */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-medium flex items-center gap-1">
            <Settings2 className="w-3.5 h-3.5 text-zinc-400" />
            Quality:
          </span>
          <div className="flex items-center rounded-lg bg-zinc-900 border border-zinc-800 p-0.5">
            {QUALITY_OPTIONS.map((q) => {
              const isActive = quality === q;
              return (
                <button
                  key={q}
                  onClick={() => handleQualityChange(q)}
                  disabled={isLoading}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                    isActive
                      ? "bg-sky-600 text-white shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  } disabled:opacity-50`}
                >
                  {q}
                </button>
              );
            })}
          </div>

          <label className="hidden lg:flex items-center gap-1.5 text-[11px] text-zinc-400 ml-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoFallback}
              onChange={(e) => setAutoFallback(e.target.checked)}
              className="rounded bg-zinc-800 border-zinc-700 text-sky-500 focus:ring-0 cursor-pointer"
            />
            <span>Auto-fallback on 404</span>
          </label>
        </div>

        {/* Telegram URL or start_param input bar */}
        <form
          onSubmit={handleManualSearch}
          className="flex items-center gap-1.5 flex-1 max-w-md min-w-[240px]"
        >
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Telegram URL or batchId_childId..."
            className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 font-mono outline-none focus:border-sky-500 transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading || !inputUrl.trim()}
            className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0"
          >
            {isLoading ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Play className="w-3 h-3 fill-current" />
            )}
            <span>Load</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default TelegramVideoPlayer;
