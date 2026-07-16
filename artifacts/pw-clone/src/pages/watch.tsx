import { useEffect, useState } from "react";
import { ArrowLeft, PlaySquare, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DrmPlayer } from "@/components/DrmPlayer";

type PlayerMode = "drm" | "extern";

export default function Watch() {
  const [params, setParams] = useState({
    batchId: "",
    childId: "",
    subjectId: "",
    title: "",
    subjectSlug: "",
    topicSlug: "",
  });
  const [player, setPlayer] = useState<PlayerMode>("extern");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setParams({
      batchId: sp.get("batchId") || "",
      childId: sp.get("childId") || sp.get("ContentId") || sp.get("videoId") || "",
      subjectId: sp.get("subjectId") || "",
      title: sp.get("title") || "Lecture Video",
      subjectSlug: sp.get("subjectSlug") || "",
      topicSlug: sp.get("topicSlug") || "",
    });
  }, []);

  const hasParams = !!(params.batchId && params.childId);

  const vidcloudUrl = (() => {
    const p = new URLSearchParams({
      batch_id: params.batchId,
      subject_id: params.subjectId,
      video_id: params.childId,
      video_type: "new",
      title: params.title,
    });
    return `https://vidcloud.eu.org/play.php?${p.toString()}`;
  })();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-black text-white">
      <header className="absolute top-0 w-full z-50 p-3 sm:p-4 bg-gradient-to-b from-black/90 to-transparent flex items-center justify-between pointer-events-none">
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/20 hover:text-white pointer-events-auto gap-1.5"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>

        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground">
            <PlaySquare className="w-3.5 h-3.5 fill-current" />
          </div>
          <span className="font-bold tracking-tight text-sm">
            PW<span className="text-primary">X</span>
          </span>
        </div>

        {params.title && (
          <div className="hidden md:block max-w-xs truncate text-xs text-zinc-400 pointer-events-none">
            {params.title}
          </div>
        )}
        <div className="w-20 md:hidden" />
      </header>

      {/* Player toggle — sits above the video */}
      {hasParams && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 flex gap-1 bg-black/70 backdrop-blur-sm rounded-full px-1 py-1 border border-white/10 pointer-events-auto">
          <button
            onClick={() => setPlayer("extern")}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${
              player === "extern"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Player 1
          </button>
          <button
            onClick={() => setPlayer("drm")}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${
              player === "drm"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Player 2
          </button>
        </div>
      )}

      <main className="flex-1 w-full h-[100dvh] flex flex-col items-center justify-center bg-black">
        {hasParams ? (
          <div className="w-full h-full">
            {player === "extern" ? (
              <iframe
                key={vidcloudUrl}
                src={vidcloudUrl}
                className="w-full h-full border-0"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
                referrerPolicy="no-referrer"
                title={params.title}
              />
            ) : (
              <DrmPlayer
                batchId={params.batchId}
                subjectId={params.subjectId}
                childId={params.childId}
                title={params.title}
              />
            )}
          </div>
        ) : (
          <div className="text-center text-muted-foreground px-4">
            <PlaySquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Invalid video parameters. Please go back and select a video.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => window.history.back()}
            >
              Go Back
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
