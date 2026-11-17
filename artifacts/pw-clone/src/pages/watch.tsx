import { useEffect, useState } from "react";
import { useScheduleDetails, getPdfUrl, useSlides } from "@/hooks/usePWApi";
import { ArrowLeft, ExternalLink, FileText, Send, Layers, X, Copy, Check, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Watch() {
  const [params, setParams] = useState({
    batchId: "",
    subjectId: "",
    videoId: "",
    videoType: "",
    topicId: "",
    backUrl: "",
  });
  const [showSlides, setShowSlides] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Parse URL params
    const searchParams = new URLSearchParams(window.location.search);
    const vId =
      searchParams.get("videoId") ||
      searchParams.get("childId") ||
      searchParams.get("scheduleId") ||
      searchParams.get("schId") ||
      searchParams.get("video_id") ||
      "";

    if (vId) {
      setParams({
        batchId: searchParams.get("batchId") || searchParams.get("batch_id") || "",
        subjectId: searchParams.get("subjectId") || searchParams.get("subject_id") || searchParams.get("subject_id_original") || "",
        videoId: vId,
        videoType: searchParams.get("video_type") || searchParams.get("videoType") || "",
        topicId: searchParams.get("topicId") || searchParams.get("topic_id") || vId,
        backUrl: searchParams.get("backUrl") || "",
      });
    }
  }, []);

  const { data: scheduleData, isLoading } = useScheduleDetails(
    params.batchId,
    params.subjectId,
    params.videoId
  );

  const { data: slidesData } = useSlides(
    params.batchId,
    params.subjectId,
    params.videoId
  );

  const schedData = scheduleData?.data;
  const sp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const title = schedData?.topic || sp?.get("title") || "Lecture Video";
  const poster = (schedData as any)?.image || sp?.get("poster") || "";

  const tgBotUrl = params.batchId && params.videoId
    ? `https://t.me/AS_MultiverseRoBot?start=${params.batchId.trim()}_${params.videoId.trim()}`
    : "";

  const hwList = schedData?.homeworkIds ?? [];
  const attachments = hwList.flatMap((hw) =>
    (hw.attachmentIds ?? [])
      .map((att) => ({
        name: att.name || hw.topic || "Attachment",
        url: getPdfUrl(att),
      }))
      .filter((a) => !!a.url && (a.url.includes(".pdf") || a.url.includes(".doc") || a.url.startsWith("http")))
  );

  const slides = slidesData?.data?.slides ?? [];

  const handleCopyLink = () => {
    if (!tgBotUrl) return;
    navigator.clipboard.writeText(tgBotUrl);
    setCopied(true);
    toast({ title: "Copied to clipboard", description: tgBotUrl });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGoBack = () => {
    if (params.backUrl) {
      window.location.href = params.backUrl;
    } else if (params.batchId) {
      window.location.href = `/batch/${encodeURIComponent(params.batchId)}`;
    } else {
      window.history.back();
    }
  };

  if (!params.videoId) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0f] text-white flex items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <h2 className="text-xl font-bold">No lecture selected</h2>
          <p className="text-zinc-400 text-sm">Please select a video from the topic or batch page.</p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#0a0a0f] text-white flex flex-col font-sans select-none">
      {/* ── Top Bar ────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={handleGoBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <h1 className="text-sm sm:text-base font-semibold text-zinc-100 truncate">
            {title}
          </h1>
        </div>

        {slides.length > 0 && (
          <button
            onClick={() => setShowSlides((p) => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
              showSlides
                ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20"
                : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Slides ({slides.length})</span>
          </button>
        )}
      </header>

      {/* ── Main Content Area ──────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center justify-center">
          <div className="w-full max-w-2xl bg-zinc-950/90 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            {/* Thumbnail preview */}
            {poster ? (
              <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/80 shadow-md">
                <img
                  src={poster}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : null}

            {/* Title & Info */}
            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-bold text-white leading-snug">
                {title}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400">
                This lecture is streamable and downloadable directly via the Telegram bot.
              </p>
            </div>

            {/* Direct Telegram Action Buttons */}
            {tgBotUrl && (
              <div className="space-y-3 pt-2">
                <a
                  href={tgBotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold text-sm shadow-xl shadow-sky-500/25 transition-all transform active:scale-[0.99] cursor-pointer"
                >
                  <Send className="w-4 h-4 fill-current" />
                  <span>Open in Telegram Bot</span>
                  <ExternalLink className="w-4 h-4 opacity-75" />
                </a>

                <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 px-3 py-2 rounded-xl text-left">
                  <span className="text-[11px] font-mono text-zinc-400 truncate flex-1 select-all">
                    {tgBotUrl}
                  </span>
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium shrink-0 transition-colors"
                    title="Copy direct Telegram bot URL"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Notes & Attachments Section */}
            {attachments.length > 0 && (
              <div className="pt-4 border-t border-zinc-800/80 text-left space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-sky-400" />
                  <span>Class Notes & Attachments ({attachments.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachments.map((att, idx) => (
                    <a
                      key={idx}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800/80 hover:border-zinc-700 text-xs text-zinc-200 transition-colors group"
                    >
                      <span className="truncate pr-2">{att.name}</span>
                      <Download className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ── Slides Drawer ──────────────────────────────────────── */}
        {showSlides && (
          <aside className="w-80 h-full bg-zinc-950 border-l border-zinc-800 flex flex-col shrink-0">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="text-white font-semibold text-sm">Slides Timeline</h3>
              <button
                onClick={() => setShowSlides(false)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {slides.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">No slides available.</p>
              ) : (
                slides.map((slide: any, idx: number) => {
                  const imgUrl = slide.img?.baseUrl + slide.img?.key;
                  return (
                    <div
                      key={slide._id || idx}
                      className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 relative group"
                    >
                      <img
                        src={imgUrl}
                        alt={`Slide ${idx + 1}`}
                        className="w-full h-auto object-cover"
                        loading="lazy"
                      />
                      <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-white text-[11px] px-2 py-0.5 rounded font-medium">
                        Slide {idx + 1}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
