import { useEffect, useState } from "react";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { DrmPlayer } from "@/components/DrmPlayer";
import { ArrowLeft, PlaySquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ScheduleWatch() {
  const [params, setParams] = useState({
    batchId: "", subjectId: "", scheduleId: "",
    title: "", thumbnail: "",
  });
  const [historyAdded, setHistoryAdded] = useState(false);
  const { addToHistory } = useWatchHistory();

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const p = {
      batchId: sp.get("batchId") || "",
      subjectId: sp.get("subjectId") || "",
      scheduleId: sp.get("scheduleId") || "",
      title: sp.get("title") || sp.get("topic") || "Lecture Video",
      thumbnail: sp.get("thumbnail") || "",
    };
    setParams(p);

    if (p.batchId && p.scheduleId && !historyAdded) {
      addToHistory({
        scheduleId: p.scheduleId,
        batchId: p.batchId,
        subjectId: p.subjectId,
        title: p.title,
        thumbnail: p.thumbnail || undefined,
        watchedAt: Date.now(),
      });
      setHistoryAdded(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasParams = !!(params.batchId && params.scheduleId);

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

      <main className="flex-1 w-full h-[100dvh] flex flex-col items-center justify-center bg-black">
        {hasParams ? (
          <div className="w-full h-full">
            <DrmPlayer
              batchId={params.batchId}
              subjectId={params.subjectId}
              childId={params.scheduleId}
              title={params.title}
              poster={params.thumbnail || undefined}
            />
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
