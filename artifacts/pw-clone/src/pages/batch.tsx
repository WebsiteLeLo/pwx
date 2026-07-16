import React, { useState, useEffect } from "react";
import { useBatchDetails, useTodaysSchedule, getScheduleItemKind, getPdfUrl, type ScheduleItem, type Batch } from "@/hooks/usePWApi";
import { useCustomBatches, MixSubject } from "@/hooks/useCustomBatches";
import { useEnrolledBatches } from "@/hooks/useEnrolledBatches";
import { Layout } from "@/components/layout";
import { LazyImage } from "@/components/lazy-image";
import { Link, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlertCircle, BookOpen, User, PlayCircle, Plus, Check, Layers, Share2, X, CheckCircle2, CalendarDays, Radio, Clock, RefreshCw, FileText, Dumbbell } from "lucide-react";
import { ogUrl } from "@/lib/apiUrl";

// ── helpers ────────────────────────────────────────────────────────────────
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

const KIND_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  notes: { label: "Notes", icon: <FileText className="w-3 h-3" />, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  dpp: { label: "DPP", icon: <FileText className="w-3 h-3" />, color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  exercise: { label: "Exercise", icon: <Dumbbell className="w-3 h-3" />, color: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  other: { label: "Material", icon: <BookOpen className="w-3 h-3" />, color: "bg-secondary text-muted-foreground border-border/40" },
};

function LiveScheduleCard({ item }: { item: ScheduleItem }) {
  const status = getLectureStatus(item);
  const kind = getScheduleItemKind(item);
  const isVideo = kind === "video";
  const subjectId = item.data.subjectId._id;
  const scheduleId = item.data._id;
  const batchId = item.data.batchId;
  const topicId = item.data.tags?.[0]?._id ?? "";
  const kindMeta = KIND_META[kind] ?? KIND_META.other;

  // Thumbnail: try API imageId fields (not in TS type, cast to any)
  const raw = item.data as any;
  const thumbUrl: string | null =
    raw.imageId?.baseUrl && raw.imageId?.key
      ? `${raw.imageId.baseUrl}${raw.imageId.key}`
      : raw.image || raw.thumbnail || null;

  // Subject-based gradient for fallback thumbnail bg
  const subjectKey = item.data.subjectId.name.toLowerCase();
  const gradients: Record<string, string> = {
    physics:   "from-blue-900/80 to-blue-950",
    chemistry: "from-green-900/80 to-green-950",
    maths:     "from-purple-900/80 to-purple-950",
    math:      "from-purple-900/80 to-purple-950",
    biology:   "from-emerald-900/80 to-emerald-950",
    english:   "from-yellow-900/80 to-yellow-950",
  };
  const fallbackGrad = Object.entries(gradients).find(([k]) => subjectKey.includes(k))?.[1]
    ?? "from-primary/20 to-primary/5";

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
    window.open(`https://rarestudy.in/schedule-details?batchId=${encodeURIComponent(batchId)}&subjectId=${encodeURIComponent(subjectId)}&scheduleId=${encodeURIComponent(scheduleId)}&tap=${tap}`, "_blank", "noopener,noreferrer");
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
      className={`relative flex-shrink-0 w-64 sm:w-72 rounded-xl border bg-card overflow-hidden transition-all ${borderClass} ${isVideo && status !== "completed" ? "cursor-pointer" : ""}`}
      onClick={isVideo && status !== "upcoming" ? handleVideoWatch : undefined}
    >
      {/* Live top bar */}
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
          <div className={`w-full h-full bg-gradient-to-br ${fallbackGrad} flex items-center justify-center`}>
            <PlayCircle className="w-10 h-10 text-white/20" />
          </div>
        )}

        {/* Overlay: status badge top-left */}
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
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border ${kindMeta.color} backdrop-blur-sm`}>
              {kindMeta.icon}{kindMeta.label}
            </span>
          )}
        </div>

        {/* Overlay: time top-right */}
        <div className="absolute top-2 right-2 text-right text-xs font-medium text-white bg-black/60 rounded px-1.5 py-0.5 backdrop-blur-sm">
          {formatTime(item.data.startTime)}
        </div>

        {/* Play button center overlay for video non-upcoming */}
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
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border mb-2 ${subjectColor(item.data.subjectId.name)}`}>
          {item.data.subjectId.name}
        </span>

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

function TodaysScheduleSection({ batchId }: { batchId: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useTodaysSchedule(batchId);
  const [, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const items = data?.data ?? [];
  const videoItems = [...items]
    .filter(i => getScheduleItemKind(i) === "video")
    .sort((a, b) => new Date(a.data.startTime).getTime() - new Date(b.data.startTime).getTime());

  const liveCount = videoItems.filter(i => getLectureStatus(i) === "live").length;

  // Don't show section while loading if there's nothing yet (skip initial flicker)
  if (!isLoading && !isError && videoItems.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-base font-bold">Today's Live Schedule</h2>
          {liveCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white animate-pulse">
              <Radio className="w-3 h-3" />{liveCount} Live
            </span>
          )}
          {!isLoading && videoItems.length > 0 && (
            <span className="text-xs text-muted-foreground">{videoItems.length} class{videoItems.length !== 1 ? "es" : ""}</span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Refresh schedule"
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
          Failed to load today's schedule.
          <button onClick={() => refetch()} className="underline ml-auto cursor-pointer">Retry</button>
        </div>
      )}

      {!isLoading && !isError && videoItems.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory [scrollbar-width:thin]">
          <AnimatePresence>
            {videoItems.map(item => (
              <div key={item._id} className="snap-start">
                <LiveScheduleCard item={item} />
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="mt-3 border-b border-border/30" />
    </div>
  );
}

function AddToMixDialog({
  open,
  onClose,
  subject,
  batchId,
  batchName,
}: {
  open: boolean;
  onClose: () => void;
  subject: MixSubject;
  batchId: string;
  batchName: string;
}) {
  const { mixes, createMix, addSubject, isSubjectInMix } = useCustomBatches();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const id = createMix(newName.trim());
    addSubject(id, subject);
    setNewName("");
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Mix</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">
          Adding <span className="font-semibold text-foreground">{subject.subjectName}</span>
          {" "}from <span className="font-semibold text-foreground">{batchName}</span>
        </p>

        {mixes.length === 0 && !creating && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            No mixes yet. Create one below.
          </div>
        )}

        {mixes.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {mixes.map(mix => {
              const added = isSubjectInMix(mix.id, batchId, subject.subjectId);
              return (
                <button
                  key={mix.id}
                  onClick={() => { if (!added) { addSubject(mix.id, subject); onClose(); } }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${
                    added
                      ? "border-primary/30 bg-primary/5 cursor-default"
                      : "border-border/50 hover:border-primary/40 hover:bg-muted cursor-pointer"
                  }`}
                >
                  <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{mix.name}</p>
                    <p className="text-xs text-muted-foreground">{mix.subjects.length} subjects</p>
                  </div>
                  {added && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {creating ? (
          <div className="flex gap-2 pt-1">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
              placeholder="Mix name..."
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <Button size="sm" disabled={!newName.trim()} onClick={handleCreate} className="cursor-pointer">Create</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)} className="cursor-pointer">Cancel</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="gap-2 cursor-pointer" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" /> New Mix
          </Button>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="cursor-pointer">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Batch() {
  const { batchId } = useParams<{ batchId: string }>();
  const { data, isLoading, isError, refetch } = useBatchDetails(batchId!);
  const { getSubjectMixes } = useCustomBatches();
  const { enroll, unenroll, isEnrolled } = useEnrolledBatches();
  const [dialogSubject, setDialogSubject] = useState<MixSubject | null>(null);
  const [copied, setCopied] = useState(false);

  const enrolled = isEnrolled(batchId!);

  if (isError) {
    return (
      <Layout breadcrumbs={[{ label: "Home", href: "/" }, { label: "Error" }]}>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h2 className="text-2xl font-bold">Failed to load subjects</h2>
          <p className="text-muted-foreground max-w-md">
            We couldn't retrieve the batch details. Please check your connection and try again.
          </p>
          <Button onClick={() => refetch()} variant="outline">Retry Connection</Button>
        </div>
      </Layout>
    );
  }

  const batchName = data?.data.name || "Loading...";

  const handleShare = async () => {
    const url = ogUrl(`/og/batch/${batchId}`);
    try {
      if (navigator.share) {
        await navigator.share({ title: batchName, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  };

  return (
    <Layout breadcrumbs={[{ label: "Home", href: "/" }, { label: batchName }]}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight">Subjects</h1>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Enroll / Unenroll */}
          {enrolled ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Unenroll</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unenroll from this batch?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You are about to unenroll from{" "}
                    <span className="font-semibold text-foreground">{batchName}</span>.
                    It will be removed from your <strong>My Batches</strong> list.
                    You can always re-enroll later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => unenroll(batchId!)}
                  >
                    Yes, Unenroll
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              size="sm"
              className="gap-1.5"
              disabled={isLoading}
              onClick={() => data && enroll(data.data as unknown as Batch)}
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Enroll</span>
            </Button>
          )}

          {/* Calendar */}
          <Link
            href={`/batch/${batchId}/calendar`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-border text-sm font-medium transition-all"
            title="View lecture calendar"
          >
            <CalendarDays className="w-4 h-4" />
            <span className="hidden sm:inline">Calendar</span>
          </Link>

          {/* Share */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            title="Share this batch"
            className="flex items-center gap-2"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? "Copied!" : "Share"}</span>
          </Button>
        </div>
      </div>

      {/* Enrolled badge */}
      {enrolled && (
        <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Enrolled in this batch
        </div>
      )}

      {/* Today's live lecture schedule for this batch */}
      <TodaysScheduleSection batchId={batchId!} />

      {/* Subjects heading */}
      <h2 className="text-base font-bold mb-4 flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-muted-foreground" />
        Subjects
      </h2>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 p-4 border border-border/50 rounded-xl">
              <Skeleton className="w-24 h-24 rounded-lg" />
              <div className="flex flex-col flex-1 gap-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3 mt-auto" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {data?.data.subjects.map((subject, index) => {
              const imageUrl = subject.imageId
                ? `${subject.imageId.baseUrl}${subject.imageId.key}`
                : undefined;
              const teacherNames = subject.teacherIds
                ? subject.teacherIds.map(t => `${t.firstName} ${t.lastName}`).join(", ")
                : "";
              const inMixCount = getSubjectMixes(batchId!, subject._id).length;

              const mixSubject: MixSubject = {
                batchId: batchId!,
                batchName,
                subjectId: subject._id,
                subjectName: subject.subject,
                teacherNames,
                lectureCount: subject.lectureCount || 0,
                imageUrl,
              };

              return (
                <motion.div
                  key={subject._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: index * 0.03 }}
                  className="group relative bg-card rounded-xl border border-border/50 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 overflow-hidden"
                >
                  <Link href={`/batch/${batchId}/subject/${subject._id}`} className="flex gap-5 p-5">
                    <div className="w-24 h-24 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                      {subject.imageId ? (
                        <LazyImage
                          src={imageUrl!}
                          alt={subject.subject}
                          fallbackText={subject.subject[0]}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-background">
                          <BookOpen className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col flex-1 min-w-0">
                      <h3 className="font-bold text-lg leading-tight mb-1 truncate group-hover:text-primary transition-colors">
                        {subject.subject}
                      </h3>

                      {subject.teacherIds && subject.teacherIds.length > 0 && (
                        <div className="flex items-center text-sm text-muted-foreground mb-3 truncate">
                          <User className="w-4 h-4 mr-1 flex-shrink-0" />
                          <span className="truncate">{teacherNames}</span>
                        </div>
                      )}

                      <div className="mt-auto flex items-center gap-3">
                        <span className="inline-flex items-center px-2 py-1 rounded bg-secondary text-secondary-foreground text-xs font-medium">
                          <PlayCircle className="w-3 h-3 mr-1" />
                          {subject.lectureCount || 0} Lectures
                        </span>
                        {inMixCount > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-primary/10 text-primary text-xs font-medium gap-1">
                            <Layers className="w-3 h-3" /> In {inMixCount} mix{inMixCount !== 1 ? "es" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>

                  <div className="border-t border-border/40 px-5 py-2.5 flex items-center justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs h-7 text-muted-foreground hover:text-primary cursor-pointer"
                      onClick={e => { e.preventDefault(); setDialogSubject(mixSubject); }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add to Mix
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {(!data?.data.subjects || data.data.subjects.length === 0) && (
            <div className="col-span-full flex flex-col items-center justify-center p-12 bg-card rounded-xl border border-border/50">
              <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-bold">No Subjects Found</h3>
              <p className="text-muted-foreground">This batch currently has no published subjects.</p>
            </div>
          )}
        </div>
      )}

      {dialogSubject && (
        <AddToMixDialog
          open={!!dialogSubject}
          onClose={() => setDialogSubject(null)}
          subject={dialogSubject}
          batchId={batchId!}
          batchName={batchName}
        />
      )}
    </Layout>
  );
}
