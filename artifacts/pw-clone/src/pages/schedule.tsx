import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { useTodaysSchedule, type ScheduleItem } from "@/hooks/usePWApi";
import { useEnrolledBatches } from "@/hooks/useEnrolledBatches";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Calendar, Radio, Clock, ChevronRight, BookOpen, PlayCircle,
  RefreshCw, AlertCircle, CheckCircle2, Loader2,
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
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function subjectColor(name: string) {
  const map: Record<string, string> = {
    physics: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    chemistry: "bg-green-500/10 text-green-400 border-green-500/20",
    maths: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    math: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    biology: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    english: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  };
  const key = name.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (key.includes(k)) return v;
  }
  return "bg-primary/10 text-primary border-primary/20";
}

interface ScheduleCardProps {
  item: ScheduleItem;
  batchName: string;
  now: number;
}

function ScheduleCard({ item, batchName, now: _now }: ScheduleCardProps) {
  const [, navigate] = useLocation();
  const status = getLectureStatus(item);
  const subjectId = item.data.subjectId._id;
  const scheduleId = item.data._id;
  const batchId = item.data.batchId;
  const tag = item.data.tags?.[0]?.name;

  const handleWatch = () => {
    navigate(
      `/schedule-watch?batchId=${encodeURIComponent(batchId)}&subjectId=${encodeURIComponent(subjectId)}&scheduleId=${encodeURIComponent(scheduleId)}`
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`relative rounded-xl border overflow-hidden transition-colors ${
        status === "live"
          ? "border-red-500/50 bg-red-950/10 hover:border-red-500/70"
          : status === "completed"
          ? "border-border/30 bg-card/50 opacity-70"
          : "border-border/50 bg-card hover:border-primary/40"
      }`}
    >
      {status === "live" && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 via-red-400 to-red-500 animate-pulse" />
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border ${subjectColor(item.data.subjectId.name)}`}>
              {item.data.subjectId.name}
            </span>
            {status === "live" && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-red-500 text-white">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
            )}
            {status === "completed" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                <CheckCircle2 className="w-3 h-3" /> Ended
              </span>
            )}
            {status === "upcoming" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                <Clock className="w-3 h-3" /> Upcoming
              </span>
            )}
          </div>
          <div className="text-right text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
            <div>{formatTime(item.data.startTime)}</div>
            <div className="opacity-60">→ {formatTime(item.data.endTime)}</div>
          </div>
        </div>

        <h3 className={`font-semibold text-sm leading-snug mb-1 line-clamp-2 ${status === "completed" ? "text-muted-foreground" : "text-foreground"}`}>
          {item.data.topic.trim()}
        </h3>
        {tag && tag !== item.data.topic.trim() && (
          <p className="text-xs text-muted-foreground mb-3 truncate">{tag}</p>
        )}

        <div className="flex items-center justify-between gap-2 mt-3">
          <span className="text-xs text-muted-foreground truncate max-w-[160px]">
            {batchName}
          </span>
          {(status === "live" || status === "upcoming") && (
            <Button
              size="sm"
              variant={status === "live" ? "default" : "outline"}
              className={`h-7 text-xs gap-1 flex-shrink-0 ${status === "live" ? "bg-red-500 hover:bg-red-600 text-white border-0" : ""}`}
              onClick={handleWatch}
            >
              {status === "live" ? (
                <><Radio className="w-3 h-3" /> Watch Live</>
              ) : (
                <><PlayCircle className="w-3 h-3" /> Watch</>
              )}
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

  const sorted = [...items].sort(
    (a, b) => new Date(a.data.startTime).getTime() - new Date(b.data.startTime).getTime()
  );

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
          {!isLoading && items.length > 0 && (
            <span className="text-xs text-muted-foreground">{items.length} class{items.length !== 1 ? "es" : ""} today</span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/40 p-4 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Failed to load schedule.
          <button onClick={() => refetch()} className="underline ml-auto">Retry</button>
        </div>
      )}

      {!isLoading && !isError && sorted.length === 0 && (
        <div className="rounded-xl border border-border/30 bg-card/40 p-6 flex flex-col items-center justify-center text-center gap-2">
          <Calendar className="w-8 h-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No classes scheduled for today</p>
        </div>
      )}

      {!isLoading && sorted.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence>
            {sorted.map(item => (
              <ScheduleCard key={item._id} item={item} batchName={batchName} now={now} />
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
