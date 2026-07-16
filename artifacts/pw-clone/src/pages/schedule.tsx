import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { useTodaysSchedule, getScheduleItemKind, getPdfUrl, type ScheduleItem } from "@/hooks/usePWApi";
import { useEnrolledBatches } from "@/hooks/useEnrolledBatches";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Calendar, Radio, Clock, ChevronRight, BookOpen, PlayCircle,
  RefreshCw, AlertCircle, CheckCircle2, Loader2, FileText, Dumbbell,
} from "lucide-react";

function getLectureStatus(item: ScheduleItem): "live" | "upcoming" | "completed" {
  const now = Date.now();
  const start = new Date(item.data.startTime).getTime();
  const end = new Date(item.data.endTime).getTime();
  if (item.data.status === "LIVE" || (now >= start && now <= end)) return "live";
  if (now > end || item.data.status === "COMPLETED") return "completed";
  return "upcoming";
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function subjectColor(name: string) {
  const map: Record<string, string> = {
    physics:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
    chemistry: "bg-green-500/10 text-green-400 border-green-500/20",
    maths:     "bg-purple-500/10 text-purple-400 border-purple-500/20",
    math:      "bg-purple-500/10 text-purple-400 border-purple-500/20",
    biology:   "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    english:   "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  };
  const key = name.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (key.includes(k)) return v;
  }
  return "bg-primary/10 text-primary border-primary/20";
}

const gradients: Record<string, string> = {
  physics:   "from-blue-900/80 to-blue-950",
  chemistry: "from-green-900/80 to-green-950",
  maths:     "from-purple-900/80 to-purple-950",
  math:      "from-purple-900/80 to-purple-950",
  biology:   "from-emerald-900/80 to-emerald-950",
  english:   "from-yellow-900/80 to-yellow-950",
};

function subjectGradient(name: string) {
  const key = name.toLowerCase();
  return Object.entries(gradients).find(([k]) => key.includes(k))?.[1] ?? "from-primary/20 to-primary/5";
}

interface ScheduleCardProps {
  item: ScheduleItem;
  batchName: string;
  now: number;
}

const KIND_META: Record<string, { label: string; icon: ReactNode; color: string }> = {
  notes:    { label: "Notes",    icon: <FileText className="w-3 h-3" />,  color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  dpp:      { label: "DPP",      icon: <FileText className="w-3 h-3" />,  color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  exercise: { label: "Exercise", icon: <Dumbbell className="w-3 h-3" />,  color: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  other:    { label: "Material", icon: <BookOpen className="w-3 h-3" />,  color: "bg-secondary text-muted-foreground border-border/40" },
};

function ScheduleCard({ item, batchName, now: _now }: ScheduleCardProps) {
  const status = getLectureStatus(item);
  const kind = getScheduleItemKind(item);
  const isVideo = kind === "video";
  const subjectId = item.data.subjectId._id;
  const scheduleId = item.data._id;
  const batchId = item.data.batchId;
  const topicId = item.data.tags?.[0]?._id ?? "";
  const kindMeta = KIND_META[kind] ?? KIND_META.other;

  // Thumbnail — try API fields not in TS type
  const raw = item.data as any;
  const thumbUrl: string | null =
    raw.imageId?.baseUrl && raw.imageId?.key
      ? `${raw.imageId.baseUrl}${raw.imageId.key}`
      : raw.image || raw.thumbnail || null;

  const handleVideoWatch = () => {
    const params = new URLSearchParams({ batchId, subjectId, videoId: scheduleId, title: item.data.topic.trim() });
    if (topicId) params.set("topicId", topicId);
    window.location.href = `/watch?${params.toString()}`;
  };

  const handleMaterialOpen = () => {
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

  const borderClass = isVideo
    ? status === "live"
      ? "border-red-500/50 hover:border-red-500/80"
      : status === "completed"
      ? "border-border/30 opacity-65"
      : "border-border/50 hover:border-primary/50"
    : "border-border/40 hover:border-amber-500/30";

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`relative flex-shrink-0 w-64 sm:w-72 rounded-xl border bg-card overflow-hidden transition-all ${borderClass} ${isVideo && status !== "completed" ? "cursor-pointer" : ""}`}
      onClick={isVideo && status !== "upcoming" ? handleVideoWatch : undefined}
    >
      {/* Live pulse bar */}
      {isVideo && status === "live" && (
        <div className="absolute top-0 left-0 right-0 h-0.5 z-10 bg-gradient-to-r from-red-500 via-red-400 to-red-500 animate-pulse" />
      )}

      {/* Thumbnail */}
      <div className="relative w-full aspect-video overflow-hidden bg-muted">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={item.data.topic}
            className="w-full h-full object-cover"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${subjectGradient(item.data.subjectId.name)} flex items-center justify-center`}>
            <PlayCircle className="w-10 h-10 text-white/20" />
          </div>
        )}

        {/* Badges top-left */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          {isVideo && status === "live" && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-red-500 text-white shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />LIVE
            </span>
          )}
          {isVideo && status === "upcoming" && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-black/70 text-white backdrop-blur-sm">
              <Clock className="w-3 h-3" />Upcoming
            </span>
          )}
          {isVideo && status === "completed" && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-black/70 text-white/80 backdrop-blur-sm">
              <CheckCircle2 className="w-3 h-3" />Ended
            </span>
          )}
          {!isVideo && (
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border ${kindMeta.color}`}>
              {kindMeta.icon}{kindMeta.label}
            </span>
          )}
        </div>

        {/* Time top-right */}
        <div className="absolute top-2 right-2 text-xs font-medium text-white bg-black/60 rounded px-1.5 py-0.5 backdrop-blur-sm">
          {formatTime(item.data.startTime)}
        </div>

        {/* Hover play overlay */}
        {isVideo && status !== "upcoming" && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl ${status === "live" ? "bg-red-500" : "bg-white/90"}`}>
              {status === "live"
                ? <Radio className="w-6 h-6 text-white" />
                : <PlayCircle className="w-6 h-6 text-gray-900" />}
            </div>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border ${subjectColor(item.data.subjectId.name)}`}>
            {item.data.subjectId.name}
          </span>
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">{batchName}</span>
        </div>

        <h3 className={`font-semibold text-sm leading-snug line-clamp-2 mb-3 ${status === "completed" ? "text-muted-foreground" : "text-foreground"}`}>
          {item.data.topic.trim()}
        </h3>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {formatTime(item.data.startTime)} → {formatTime(item.data.endTime)}
          </span>
          {isVideo ? (
            status === "upcoming" ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                <Clock className="w-3 h-3" />Soon
              </span>
            ) : (
              <Button
                size="sm"
                variant={status === "live" ? "default" : "outline"}
                className={`h-7 text-xs gap-1 flex-shrink-0 cursor-pointer ${status === "live" ? "bg-red-500 hover:bg-red-600 text-white border-0" : ""}`}
                onClick={e => { e.stopPropagation(); handleVideoWatch(); }}
              >
                {status === "live" ? <><Radio className="w-3 h-3" />Watch</> : <><PlayCircle className="w-3 h-3" />Play</>}
              </Button>
            )
          ) : (
            <Button
              size="sm" variant="outline"
              className="h-7 text-xs gap-1 flex-shrink-0 cursor-pointer border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              onClick={e => { e.stopPropagation(); handleMaterialOpen(); }}
            >
              {kindMeta.icon}Open
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface BatchScheduleSectionProps {
  batchId: string;
  batchName: string;
  now: number;
}

function BatchScheduleSection({ batchId, batchName, now }: BatchScheduleSectionProps) {
  const { data, isLoading, isError, refetch, isFetching } = useTodaysSchedule(batchId);
  const items = data?.data ?? [];

  const sorted = [...items]
    .filter(i => getScheduleItemKind(i) === "video")
    .sort((a, b) => new Date(a.data.startTime).getTime() - new Date(b.data.startTime).getTime());

  const liveCount = sorted.filter(i => getLectureStatus(i) === "live").length;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold leading-tight">{batchName}</h2>
          {liveCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white animate-pulse">
              <Radio className="w-3 h-3" /> {liveCount} Live
            </span>
          )}
          {!isLoading && sorted.length > 0 && (
            <span className="text-xs text-muted-foreground">{sorted.length} class{sorted.length !== 1 ? "es" : ""} today</span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-64 sm:w-72 rounded-xl border border-border/40 overflow-hidden">
              <Skeleton className="w-full aspect-video" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
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

      {!isLoading && !isError && sorted.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory [scrollbar-width:thin]">
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

export default function Schedule() {
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
          <BatchScheduleSection
            key={batch._id}
            batchId={batch._id}
            batchName={batch.name}
            now={now}
          />
        ))
      )}
    </Layout>
  );
}
