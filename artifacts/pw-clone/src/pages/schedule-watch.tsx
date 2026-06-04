import { useEffect, useRef, useState } from "react";
import { useScheduleDetails, useVideoDetails, useVideoOtp, getPdfUrl } from "@/hooks/usePWApi";
import { ArrowLeft, PlaySquare, FileText, BookOpen, Download, Clock, Calendar, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Hls from "hls.js";

function formatDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function HlsPlayer({ videoUrl, poster }: { videoUrl: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    const hlsUrl = videoUrl.replace("master.mpd", "master.m3u8");

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
      video.play().catch(() => {});
    }
  }, [videoUrl]);

  return (
    <video
      ref={videoRef}
      poster={poster}
      controls
      className="w-full h-full object-contain bg-black"
      style={{ maxHeight: "100%" }}
    />
  );
}

function OtpPlayer({ otp }: { otp: string }) {
  return (
    <iframe
      src={`https://player.vdocipher.com/v2/?otp=${encodeURIComponent(otp)}&playerKey=qm0CJa7WbLFi6q3E&v=3`}
      allowFullScreen
      allow="encrypted-media"
      className="w-full h-full border-0"
      title="VdoCipher Player"
    />
  );
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
    batchId: "", subjectId: "", scheduleId: "", otpKey: "",
  });
  const [materialsOpen, setMaterialsOpen] = useState(true);
  const [playerMode, setPlayerMode] = useState<"hls" | "otp">("hls");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setParams({
      batchId: sp.get("batchId") || "",
      subjectId: sp.get("subjectId") || "",
      scheduleId: sp.get("scheduleId") || "",
      otpKey: sp.get("key") || "",
    });
  }, []);

  const { data: scheduleData, isLoading: scheduleLoading } = useScheduleDetails(
    params.batchId, params.subjectId, params.scheduleId
  );
  const schedule = scheduleData?.data;
  const videoId = schedule?.videoDetails?._id || "";

  const { data: videoData, isLoading: videoLoading } = useVideoDetails(videoId);
  const video = videoData?.data;

  const { data: otpData, isLoading: otpLoading } = useVideoOtp(params.otpKey);
  const otp = otpData?.data?.otp || "";

  const allPdfs: { name?: string; url: string }[] = [];
  (schedule?.homeworkIds || []).forEach((hw) => {
    (hw.attachmentIds || []).forEach((att) => {
      if (att.key || att.baseUrl) {
        allPdfs.push({ name: att.name, url: getPdfUrl(att) });
      }
    });
  });

  const dppPdfs: { name?: string; url: string }[] = [];
  (schedule?.dpp?.homeworkIds || []).forEach((hw) => {
    (hw.attachmentIds || []).forEach((att) => {
      if (att.key || att.baseUrl) {
        dppPdfs.push({ name: att.name, url: getPdfUrl(att) });
      }
    });
  });

  const isLoading = scheduleLoading || videoLoading;

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

        <div className="flex items-center gap-2">
          {otp && (
            <div className="flex items-center gap-1 bg-zinc-800 rounded-full p-0.5">
              <button
                onClick={() => setPlayerMode("hls")}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  playerMode === "hls" ? "bg-primary text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                HLS
              </button>
              <button
                onClick={() => setPlayerMode("otp")}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  playerMode === "otp" ? "bg-primary text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                VdoCipher
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Video Panel */}
        <div className="flex-1 flex flex-col bg-black min-h-0">
          {/* Video */}
          <div className="relative w-full bg-black" style={{ paddingBottom: "56.25%" }}>
            <div className="absolute inset-0 flex items-center justify-center">
              {isLoading ? (
                <div className="flex flex-col items-center gap-3 text-zinc-500">
                  <Loader2 className="w-10 h-10 animate-spin" />
                  <span className="text-sm">Loading video…</span>
                </div>
              ) : playerMode === "otp" && otp ? (
                <OtpPlayer otp={otp} />
              ) : video?.videoUrl ? (
                <HlsPlayer
                  videoUrl={video.videoUrl}
                  poster={schedule?.videoDetails?.image}
                />
              ) : schedule?.videoDetails?._id ? (
                <iframe
                  src={`https://videoplayerofpw.onrender.com/?batchId=${params.batchId}&childId=${schedule.videoDetails._id}&ContentId=${schedule.videoDetails._id}`}
                  allowFullScreen
                  className="w-full h-full border-0"
                  title="PW Video Player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              ) : (
                <div className="text-zinc-500 text-sm">No video available</div>
              )}
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
                  {otp && (
                    <Badge variant="outline" className="text-green-400 border-green-700 text-[10px] py-0">
                      OTP Ready
                    </Badge>
                  )}
                  {otpLoading && params.otpKey && (
                    <span className="flex items-center gap-1 text-yellow-500">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Fetching OTP…
                    </span>
                  )}
                  {video?.drmProtected === false && (
                    <Badge variant="outline" className="text-blue-400 border-blue-700 text-[10px] py-0">
                      Direct Stream
                    </Badge>
                  )}
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
            {/* Class Notes */}
            {allPdfs.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <FileText className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Class Notes</span>
                  <span className="text-xs text-zinc-600">({allPdfs.length})</span>
                </div>
                <div className="space-y-1.5">
                  {allPdfs.map((pdf, i) => (
                    <PdfItem key={i} name={pdf.name} url={pdf.url} />
                  ))}
                </div>
              </div>
            )}

            {/* DPP PDFs */}
            {dppPdfs.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">DPP Practice</span>
                  <span className="text-xs text-zinc-600">({dppPdfs.length})</span>
                </div>
                <div className="space-y-1.5">
                  {dppPdfs.map((pdf, i) => (
                    <PdfItem key={i} name={pdf.name} url={pdf.url} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state while loading */}
            {scheduleLoading && (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-zinc-800 animate-pulse" />
                ))}
              </div>
            )}

            {!scheduleLoading && allPdfs.length === 0 && dppPdfs.length === 0 && (
              <div className="text-center py-8 text-zinc-600 text-sm">
                No study materials for this class
              </div>
            )}

            {/* OTP Debug Info */}
            {otp && (
              <div className="mt-4 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <p className="text-xs font-semibold text-green-400 mb-1">VdoCipher OTP Active</p>
                <p className="text-[10px] text-zinc-500 font-mono break-all">{otp.substring(0, 32)}…</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
