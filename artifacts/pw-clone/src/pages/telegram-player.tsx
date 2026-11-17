import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { TelegramVideoPlayer } from "@/components/TelegramVideoPlayer";
import { Bot, ArrowLeft, Clock, HardDrive, Play, Zap, RefreshCw } from "lucide-react";
import { formatBytes } from "@/lib/telegramVideoApi";

interface CachedVideoItem {
  id: number;
  start_param: string;
  quality: string;
  title: string;
  file_size?: number;
  created_at?: string;
  direct_watch_url?: string;
  direct_download_url?: string;
}

export default function TelegramPlayerPage() {
  const [, setLocation] = useLocation();
  const [selectedUrl, setSelectedUrl] = useState<string>("");
  const [cachedVideos, setCachedVideos] = useState<CachedVideoItem[]>([]);
  const [loadingCached, setLoadingCached] = useState<boolean>(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get("url") || params.get("link") || params.get("start") || "";
    const bId = params.get("batchId") || params.get("batch_id") || "";
    const cId = params.get("childId") || params.get("child_id") || params.get("videoId") || "";

    if (urlParam) {
      setSelectedUrl(urlParam);
    } else if (bId && cId) {
      setSelectedUrl(`${bId}_${cId}`);
    } else {
      setSelectedUrl("698ad3519549b300a5e1cc6a_6a928fc593ae187d25d4bc13");
    }

    // Fetch cached videos from backend
    setLoadingCached(true);
    fetch("https://videos.pwxstudy.site/api/videos?limit=20")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.videos && Array.isArray(data.videos)) {
          setCachedVideos(data.videos);
        }
      })
      .catch(() => {
        // Fallback: ignore error if offline
      })
      .finally(() => setLoadingCached(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#08080c] text-white flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="h-14 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md px-4 flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/pw")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">
                Telegram Stream Player
              </h1>
              <p className="text-[11px] text-zinc-400 leading-tight mt-0.5">
                Automated Bot Resolver &bull; videos.pwxstudy.site
              </p>
            </div>
          </div>
        </div>

        <a
          href="https://videos.pwxstudy.site/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-400 hover:text-sky-400 transition-colors hidden sm:block font-mono"
        >
          API Docs &rarr;
        </a>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col lg:flex-row max-w-[1800px] w-full mx-auto p-4 gap-4 min-h-0">
        {/* Left: Player Stage */}
        <section className="flex-1 flex flex-col min-h-[460px] lg:min-h-0 bg-black rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">
          {selectedUrl && (
            <TelegramVideoPlayer
              key={selectedUrl}
              videoUrl={selectedUrl}
              onBackToNative={() => setLocation("/pw")}
              className="w-full h-full"
            />
          )}
        </section>

        {/* Right: Cached Videos Sidebar */}
        <aside className="w-full lg:w-96 flex flex-col bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-4 gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                Instant Cached Videos
              </h2>
            </div>
            {loadingCached && <RefreshCw className="w-3.5 h-3.5 text-zinc-500 animate-spin" />}
          </div>
          <p className="text-[11px] text-zinc-400">
            These lectures are already indexed in the Telegram database and load in &lt;30ms.
          </p>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[600px]">
            {cachedVideos.length === 0 && !loadingCached ? (
              <div className="text-center py-8 text-xs text-zinc-500">
                No cached videos found in database. Enter a start parameter or link above to extract.
              </div>
            ) : (
              cachedVideos.map((item) => {
                const isSelected = selectedUrl.includes(item.start_param);
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedUrl(item.start_param)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-left space-y-1.5 ${
                      isSelected
                        ? "bg-sky-500/10 border-sky-500/40 text-white"
                        : "bg-zinc-900/50 hover:bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xs font-medium line-clamp-2 leading-snug">
                        {item.title}
                      </h3>
                      <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-sky-400 border border-zinc-700">
                        {item.quality}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-mono">
                      {item.file_size && (
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3 text-zinc-500" />
                          {formatBytes(item.file_size)}
                        </span>
                      )}
                      {item.created_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          {item.created_at.split(" ")[0]}
                        </span>
                      )}
                    </div>

                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[200px]">
                        {item.start_param}
                      </span>
                      <span className="text-[11px] text-sky-400 font-medium flex items-center gap-1">
                        <Play className="w-2.5 h-2.5 fill-current" />
                        Play
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
