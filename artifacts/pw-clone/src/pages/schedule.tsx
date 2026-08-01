import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { useTodaysSchedule, getScheduleItemKind, getPdfUrl, type ScheduleItem } from "@/hooks/usePWApi";
import { useEnrolledBatches } from "@/hooks/useEnrolledBatches";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Calendar, Radio, Clock, ChevronRight, ChevronLeft, BookOpen, PlayCircle,
  RefreshCw, AlertCircle, CheckCircle2, Loader2, FileText, Dumbbell, X,
  Zap, FlaskConical, Calculator, Dna, BookText,
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────
function getLectureStatus(item: ScheduleItem): "live" | "upcoming" | "completed" {
  const now   = Date.now();
  const start = new Date(item.data.startTime).getTime();
  const end   = new Date(item.data.endTime).getTime();
  if (item.data.status === "LIVE" || (now >= start && now <= end)) return "live";
  if (now > end || item.data.status === "COMPLETED") return "completed";
  return "upcoming";
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(Math.abs(diff) / 60_000);
  if (mins < 1) return "just now";
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs === 0) return `${mins}m ago`;
  return rem > 0 ? `${hrs}h ${rem}m ago` : `${hrs}h ago`;
}

interface SubjectMeta {
  bg: string;
  iconBg: string;
  iconEl: ReactNode;
}

function getSubjectMeta(name: string): SubjectMeta {
  const key = name.toLowerCase();
  if (key.includes("physics"))
    return { bg: "bg-sky-100 dark:bg-sky-950",   iconBg: "bg-sky-200 dark:bg-sky-900",      iconEl: <Zap        className="w-10 h-10 text-sky-500 dark:text-sky-300" /> };
  if (key.includes("chem"))
    return { bg: "bg-emerald-100 dark:bg-emerald-950", iconBg: "bg-emerald-200 dark:bg-emerald-900", iconEl: <FlaskConical className="w-10 h-10 text-emerald-600 dark:text-emerald-300" /> };
  if (key.includes("math"))
    return { bg: "bg-violet-100 dark:bg-violet-950", iconBg: "bg-violet-200 dark:bg-violet-900", iconEl: <Calculator  className="w-10 h-10 text-violet-600 dark:text-violet-300" /> };
  if (key.includes("bio"))
    return { bg: "bg-green-100 dark:bg-green-950",  iconBg: "bg-green-200 dark:bg-green-900",   iconEl: <Dna        className="w-10 h-10 text-green-600 dark:text-green-300" /> };
  if (key.includes("eng") || key.includes("lang"))
    return { bg: "bg-amber-100 dark:bg-amber-950",  iconBg: "bg-amber-200 dark:bg-amber-900",   iconEl: <BookText   className="w-10 h-10 text-amber-600 dark:text-amber-300" /> };
  return   { bg: "bg-slate-100 dark:bg-slate-900",  iconBg: "bg-slate-200 dark:bg-slate-800",   iconEl: <BookOpen   className="w-10 h-10 text-slate-500 dark:text-slate-400" /> };
}

const KIND_META: Record<string, { label: string; icon: ReactNode; color: string }> = {
  notes:    { label: "Notes",    icon: <FileText className="w-3 h-3" />, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  dpp:      { label: "DPP",      icon: <FileText className="w-3 h-3" />, color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  exercise: { label: "Exercise", icon: <Dumbbell className="w-3 h-3" />, color: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  other:    { label: "Material", icon: <BookOpen className="w-3 h-3" />, color: "bg-secondary text-muted-foreground border-border/40" },
};

// ── Live iframe modal ─────────────────────────────────────────────────────────
function LivePlayerModal({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black" style={{ isolation: "isolate" }}>
      {/* Floating close button */}
      <button
        onClick={onClose}
        className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-white/80 hover:text-white hover:bg-black/80 transition-colors text-sm font-medium cursor-pointer"
      >
        <X className="w-4 h-4" />
        Close
      </button>
      {/* Iframe — full screen */}
      <iframe
        src={src}
        className="w-full h-full border-none block"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture; camera; microphone"
        allowFullScreen
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock allow-top-navigation-by-user-activation allow-popups"
        title={title}
      />
    </div>
  );
}

// ── PW-style schedule card ─────────────────────────────────────────────────────
interface ScheduleCardProps { item: ScheduleItem; batchName: string; now: number; }

function ScheduleCard({ item, batchName, now: _now }: ScheduleCardProps) {
  const [liveModal, setLiveModal] = useState<string | null>(null);
  const status      = getLectureStatus(item);
  const kind        = getScheduleItemKind(item);
  const isVideo     = kind === "video";
  const subjectId   = item.data.subjectId._id;
  const scheduleId  = item.data._id;
  const batchId     = item.data.batchId;
  const topicId     = item.data.tags?.[0]?._id ?? scheduleId;
  const subjectName = item.data.subjectId.name;
  const kindMeta    = KIND_META[kind] ?? KIND_META.other;

  // Thumbnail & teacher name — try undocumented API fields
  const raw = item.data as any;
  const thumbUrl: string | null =
    raw.imageId?.baseUrl && raw.imageId?.key ? `${raw.imageId.baseUrl}${raw.imageId.key}`
    : raw.image || raw.thumbnail || raw.teacherImageUrl || null;
  const teacherName: string = raw.teacherName || raw.teacher?.name || raw.instructorName || "";
  const meta = getSubjectMeta(subjectName);

  const buildLiveUrl = () => {
    const p = new URLSearchParams({
      batch_id:   batchId,
      subject_id: subjectId,
      topic_id:   topicId,
      video_id:   scheduleId,
      video_name: item.data.topic.trim(),
      video_img:  thumbUrl ?? "",
      video_type: "live",
      play_type:  "Lecture",
    });
    return `https://vidcloud.eu.org/play.php?${p.toString()}`;
  };

  const handleClick = () => {
    if (!isVideo || status === "upcoming") return;
    if (status === "live") {
      setLiveModal(buildLiveUrl());
    } else {
      const params = new URLSearchParams({
        batchId, subjectId, videoId: scheduleId,
        title: item.data.topic.trim(),
        backUrl: `/batch/${batchId}`,
      });
      window.location.href = `/watch?${params.toString()}`;
    }
  };

  const handleMaterialOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.data.attachmentIds && item.data.attachmentIds.length > 0) {
      const pdfUrl = getPdfUrl(item.data.attachmentIds[0]);
      if (pdfUrl) { window.open(pdfUrl, "_blank", "noopener,noreferrer"); return; }
    }
    const tap = kind === "dpp" ? "dpp" : "note";
    window.open(
      `https://rarestudy.in/schedule-details?batchId=${encodeURIComponent(batchId)}&subjectId=${encodeURIComponent(subjectId)}&scheduleId=${encodeURIComponent(scheduleId)}&tap=${tap}`,
      "_blank", "noopener,noreferrer"
    );
  };

  const cardBorder =
    status === "live"       ? "border-red-500/60 shadow-red-500/10 shadow-md"
    : status === "completed"? "border-border/30"
    : "border-border/40";

  return (
    <>
      {liveModal && <LivePlayerModal src={liveModal} title={item.data.topic.trim()} onClose={() => setLiveModal(null)} />}

      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className={`relative flex-shrink-0 w-52 rounded-2xl border bg-card overflow-hidden transition-all select-none
          ${cardBorder}
          ${isVideo && status !== "upcoming" ? "cursor-pointer hover:scale-[1.02] active:scale-[0.99]" : ""}
          ${status === "completed" ? "opacity-75" : ""}`}
        onClick={handleClick}
      >
        {/* Live shimmer border */}
        {status === "live" && (
          <div className="absolute top-0 left-0 right-0 h-[2px] z-10 bg-gradient-to-r from-red-500 via-pink-400 to-red-500 animate-pulse" />
        )}

        {/* Thumbnail */}
        <div className={`relative w-full h-40 overflow-hidden ${meta.bg}`}>
          {/* Subject icon — always in background */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${meta.iconBg}`}>
              {meta.iconEl}
            </div>
          </div>

          {/* Real thumbnail on top */}
          {thumbUrl && (
            <img
              src={thumbUrl}
              alt={subjectName}
              className="absolute inset-0 w-full h-full object-cover object-top"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}

          {/* Bottom scrim */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent pt-8 pb-2 px-3">
            <p className="text-xs font-semibold text-white truncate drop-shadow">
              {teacherName || subjectName}
            </p>
            {batchName && <p className="text-[10px] text-white/50 truncate">{batchName}</p>}
          </div>

          {/* Hover play */}
          {isVideo && status !== "upcoming" && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 bg-black/25">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-2xl ${status === "live" ? "bg-red-500" : "bg-white/90"}`}>
                {status === "live"
                  ? <Radio className="w-5 h-5 text-white" />
                  : <PlayCircle className="w-5 h-5 text-gray-900" />}
              </div>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="p-3 space-y-1.5">
          {/* time-ago + status badge */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">{timeAgo(item.data.startTime)}</span>
            {isVideo && status === "live" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white leading-none">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />Live
              </span>
            )}
            {isVideo && status === "completed" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground leading-none">
                <CheckCircle2 className="w-2.5 h-2.5" />Ended
              </span>
            )}
            {isVideo && status === "upcoming" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 leading-none">
                <Clock className="w-2.5 h-2.5" />Soon
              </span>
            )}
            {!isVideo && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border leading-none ${kindMeta.color}`}>
                {kindMeta.icon}{kindMeta.label}
              </span>
            )}
          </div>

          {/* Bold title */}
          <h3 className={`text-[13px] font-bold leading-snug line-clamp-2 ${status === "completed" ? "text-muted-foreground" : "text-foreground"}`}>
            {item.data.topic.trim()}
          </h3>

          {/* Time range */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="w-2.5 h-2.5" />
              {formatTime(item.data.startTime)} – {formatTime(item.data.endTime)}
            </span>
            {!isVideo && (
              <button className="text-[10px] text-amber-400 underline cursor-pointer" onClick={handleMaterialOpen}>
                Open
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── Per-batch section ─────────────────────────────────────────────────────────
interface BatchScheduleSectionProps { batchId: string; batchName: string; now: number; }

function BatchScheduleSection({ batchId, batchName, now }: BatchScheduleSectionProps) {
  const { data, isLoading, isError, refetch, isFetching } = useTodaysSchedule(batchId);
  const [canLeft, setCanLeft]   = useState(false);
  const [canRight, setCanRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  const items  = data?.data ?? [];
  const sorted = [...items]
    .filter(i => getScheduleItemKind(i) === "video")
    .sort((a, b) => new Date(a.data.startTime).getTime() - new Date(b.data.startTime).getTime());
  const liveCount = sorted.filter(i => getLectureStatus(i) === "live").length;

  useEffect(() => { setTimeout(updateArrows, 100); }, [data]);

  const slide = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -220 : 220, behavior: "smooth" });
    setTimeout(updateArrows, 300);
  };

  return (
    <div className="mb-10">
      {/* Batch header */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-primary inline-block" />
          <h2 className="text-lg font-bold leading-tight">{batchName}</h2>
          {liveCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white animate-pulse">
              <Radio className="w-3 h-3" /> {liveCount} Live
            </span>
          )}
          {!isLoading && sorted.length > 0 && (
            <span className="text-xs text-muted-foreground">{sorted.length} class{sorted.length !== 1 ? "es" : ""}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => slide("left")}
            disabled={!canLeft}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => slide("right")}
            disabled={!canRight}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => refetch()} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-52 rounded-2xl border border-border/40 overflow-hidden">
              <Skeleton className="w-full h-40" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Failed to load schedule.
          <button onClick={() => refetch()} className="underline ml-auto cursor-pointer">Retry</button>
        </div>
      )}

      {!isLoading && !isError && sorted.length === 0 && (
        <div className="rounded-xl border border-border/30 bg-card/40 p-6 flex flex-col items-center justify-center text-center gap-2">
          <Calendar className="w-8 h-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No classes scheduled for today</p>
        </div>
      )}

      {/* Horizontal scroll */}
      {!isLoading && !isError && sorted.length > 0 && (
        <div
          ref={scrollRef}
          onScroll={updateArrows}
          className="flex gap-3 overflow-x-auto pb-1 snap-x"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
        >
          <AnimatePresence>
            {sorted.map(item => (
              <div key={item._id} className="snap-start">
                <ScheduleCard item={item} batchName={batchName} now={now} />
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Schedule() {
  usePageMeta({
    title: "Today's PW Live Class Schedule | Physics Wallah",
    description:
      "Check today's Physics Wallah live class schedule on PWX. See lecture timings, live and upcoming classes for IIT JEE and NEET batches — updated every 2 minutes.",
    canonical: "/schedule",
  });

  const { enrolled } = useEnrolledBatches();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <Layout breadcrumbs={[{ label: "Home", href: "/" }, { label: "Today's Schedule" }]}>
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Today's Schedule</h1>
          <p className="text-lg text-muted-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {today}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin opacity-50" />
          Auto-refreshes every 2 min
        </div>
      </div>

      {enrolled.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-4">
          <BookOpen className="w-14 h-14 text-muted-foreground/30" />
          <h2 className="text-xl font-bold">No enrolled batches</h2>
          <p className="text-muted-foreground max-w-xs">
            Enroll in batches from the home page to see today's schedule here.
          </p>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Go Back
          </Button>
        </div>
      ) : (
        enrolled.map(batch => (
          <BatchScheduleSection key={batch._id} batchId={batch._id} batchName={batch.name} now={now} />
        ))
      )}
    </Layout>
  );
}
