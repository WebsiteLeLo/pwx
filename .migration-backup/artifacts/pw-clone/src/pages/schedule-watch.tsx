import { useEffect, useMemo, useState } from "react";
import { useScheduleDetails, useVideoDetails, useAttachmentUrls } from "@/hooks/usePWApi";
import { ArrowLeft, PlaySquare, FileText, BookOpen, Download, Clock, Calendar, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DrmPlayer } from "@/components/DrmPlayer";

function formatDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function PdfItem({ name, url }: { name?: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/80 transition-colors group"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-md bg-orange-500/20 flex items-center justify-center">
        <FileText className="w-4 h-4 text-orange-400" />
      </div>
      <span className="text-sm text-zinc-200 group-hover:text-white truncate flex-1">
        {name || "View PDF"}
      </span>
      <Download className="w-4 h-4 text-zinc-400 group-hover:text-white flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}

export default function ScheduleWatch() {
  const [params, setParams] = useState({
    batchId: "", subjectId: "", scheduleId: "",
  });
  const [materialsOpen, setMaterialsOpen] = useState(true);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setParams({
      batchId: sp.get("batchId") || "",
      subjectId: sp.get("subjectId") || "",
      scheduleId: sp.get("scheduleId") || "",
    });
  }, []);

  const { data: scheduleData, isLoading: scheduleLoading } = useScheduleDetails(
    params.batchId, params.subjectId, params.scheduleId
  );
  const schedule = scheduleData?.data;
  const videoId = schedule?.videoDetails?._id || "";

  const { data: videoData } = useVideoDetails(videoId);
  const video = videoData?.data;

  const { data: attachmentData, isLoading: attachmentLoading } = useAttachmentUrls(
    params.batchId, params.subjectId, params.scheduleId
  );

  const allPdfs = useMemo(() => attachmentData ?? [], [attachmentData]);

  function renderPlayer() {
    if (scheduleLoading) {
      return (
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <Loader2 className="w-10 h-10 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      );
    }

    if (!videoId) {
      return <div className="text-zinc-500 text-sm">No video available</div>;
    }

    return (
      <DrmPlayer
        batchId={params.batchId}
        subjectId={params.subjectId}
        childId={params.scheduleId}
        poster={schedule?.videoDetails?.image}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-zinc-950 text-white">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex-shrink-0 z-10">
        <Button
          variant="ghost"
          size="sm"
          className="text-zinc-300 hover:text-white hover:bg-zinc-800"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
            <PlaySquare className="w-3.5 h-3.5 text-primary-foreground fill-current" />
          </div>
          <span className="font-bold tracking-tight text-sm">
            PW<span className="text-primary">X</span>
          </span>
        </div>

        <div className="w-16" />
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Video Panel */}
        <div className="flex-1 flex flex-col bg-black min-h-0">
          {/* Video */}
          <div className="relative w-full bg-black" style={{ paddingBottom: "56.25%" }}>
            <div className="absolute inset-0 flex items-center justify-center">
              {renderPlayer()}
            </div>
          </div>

          {/* Video Meta */}
          <div className="px-4 py-3 bg-zinc-900 border-t border-zinc-800">
            {scheduleLoading ? (
              <div className="space-y-2">
                <div className="h-5 w-2/3 bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-1/3 bg-zinc-800 rounded animate-pulse" />
              </div>
            ) : (
              <>
                <h1 className="font-semibold text-base leading-snug text-white mb-2">
                  {schedule?.topic || schedule?.videoDetails?.name || "Loading…"}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                  {schedule?.date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(schedule.date)}
                    </span>
                  )}
                  {(video?.duration || schedule?.videoDetails?.duration) && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {video?.duration || schedule?.videoDetails?.duration}
                    </span>
                  )}
                  <Badge variant="outline" className="text-purple-400 border-purple-700 text-[10px] py-0">
                    PWX Player
                  </Badge>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Materials Panel */}
        <div className="w-full lg:w-80 xl:w-96 bg-zinc-900 border-t lg:border-t-0 lg:border-l border-zinc-800 flex flex-col overflow-hidden">
          <button
            className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors lg:cursor-default"
            onClick={() => setMaterialsOpen((v) => !v)}
          >
            <span className="text-sm font-semibold text-zinc-200">Study Materials</span>
            <span className="lg:hidden">
              {materialsOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </span>
          </button>

          <div className={`flex-1 overflow-y-auto p-3 space-y-4 ${!materialsOpen ? "hidden lg:block" : ""}`}>
            {allPdfs.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <FileText className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Study Materials</span>
                  <span className="text-xs text-zinc-600">({allPdfs.length})</span>
                </div>
                <div className="space-y-1.5">
                  {allPdfs.map((pdf, i) => (
                    <PdfItem key={i} name={pdf.topic} url={pdf.url} />
                  ))}
                </div>
              </div>
            )}

            {(scheduleLoading || attachmentLoading) && (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-zinc-800 animate-pulse" />
                ))}
              </div>
            )}

            {!scheduleLoading && !attachmentLoading && allPdfs.length === 0 && (
              <div className="text-center py-8 text-zinc-600 text-sm">
                No study materials for this class
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
