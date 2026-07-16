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
import { AlertCircle, BookOpen, User, PlayCircle, Plus, Check, Layers, Share2, X, CheckCircle2, CalendarDays, Radio, Clock, RefreshCw, FileText, Dumbbell, Zap, FlaskConical, Calculator, Dna, BookText } from "lucide-react";
import { ogUrl } from "@/lib/apiUrl";

// ── helpers ────────────────────────────────────────────────────────────────
function getLectureStatus(item: ScheduleItem): "live" | "upcoming" | "completed" {
  const now = Date.now();
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
  bg: string;      // Tailwind bg classes — light + dark
  iconBg: string;  // icon container bg classes
  iconEl: React.ReactNode;
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

const KIND_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  notes:    { label: "Notes",    icon: <FileText className="w-3 h-3" />, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  dpp:      { label: "DPP",      icon: <FileText className="w-3 h-3" />, color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  exercise: { label: "Exercise", icon: <Dumbbell className="w-3 h-3" />, color: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  other:    { label: "Material", icon: <BookOpen className="w-3 h-3" />, color: "bg-secondary text-muted-foreground border-border/40" },
};

// ── Live iframe modal ────────────────────────────────────────────────────────
function LivePlayerModal({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black"
      style={{ isolation: "isolate" }}
    >
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

// ── Schedule card (PW-style) ──────────────────────────────────────────────────
function LiveScheduleCard({ item }: { item: ScheduleItem }) {
  const [liveModal, setLiveModal] = useState<string | null>(null);
  const status    = getLectureStatus(item);
  const kind      = getScheduleItemKind(item);
  const isVideo   = kind === "video";
  const subjectId = item.data.subjectId._id;
  const scheduleId= item.data._id;
  const batchId   = item.data.batchId;
  const topicId   = item.data.tags?.[0]?._id ?? scheduleId;
  const kindMeta  = KIND_META[kind] ?? KIND_META.other;
  const subjectName = item.data.subjectId.name;

  // Thumbnail — try undocumented API fields first
  const raw = item.data as any;
  const thumbUrl: string | null =
    raw.imageId?.baseUrl && raw.imageId?.key ? `${raw.imageId.baseUrl}${raw.imageId.key}`
    : raw.image || raw.thumbnail || raw.teacherImageUrl || null;

  // Teacher name — try undocumented fields
  const teacherName: string =
    raw.teacherName || raw.teacher?.name || raw.instructorName || "";

  // Initials for avatar fallback
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
      // completed → internal /watch (video_type=new via existing player)
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
    window.open(`https://rarestudy.in/schedule-details?batchId=${encodeURIComponent(batchId)}&subjectId=${encodeURIComponent(subjectId)}&scheduleId=${encodeURIComponent(scheduleId)}&tap=${tap}`, "_blank", "noopener,noreferrer");
  };

  const cardBorder =
    status === "live"      ? "border-red-500/60 shadow-red-500/10 shadow-md"
    : status === "completed" ? "border-border/30"
    : "border-border/40";

  return (
    <>
      {liveModal && (
        <LivePlayerModal src={liveModal} title={item.data.topic.trim()} onClose={() => setLiveModal(null)} />
      )}

      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        className={`relative flex-shrink-0 w-52 rounded-2xl border bg-card overflow-hidden transition-all select-none
          ${cardBorder}
          ${isVideo && status !== "upcoming" ? "cursor-pointer hover:scale-[1.02] active:scale-[0.99] transition-transform" : ""}
          ${status === "completed" ? "opacity-75" : ""}`}
        onClick={handleClick}
      >
        {/* Live shimmer top border */}
        {status === "live" && (
          <div className="absolute top-0 left-0 right-0 h-[2px] z-10 bg-gradient-to-r from-red-500 via-pink-400 to-red-500 animate-pulse" />
        )}

        {/* ── Thumbnail ── */}
        <div className={`relative w-full h-40 overflow-hidden ${meta.bg}`}>
          {/* Subject icon — always in background */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${meta.iconBg}`}>
              {meta.iconEl}
            </div>
          </div>

          {/* Real thumbnail on top (hides on error, icon shows through) */}
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
          </div>

          {/* Hover play overlay */}
          {isVideo && status !== "upcoming" && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 bg-black/20">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-2xl ${status === "live" ? "bg-red-500" : "bg-white/90"}`}>
                {status === "live" ? <Radio className="w-5 h-5 text-white" /> : <PlayCircle className="w-5 h-5 text-gray-900" />}
              </div>
            </div>
          )}
        </div>

        {/* ── Card body ── */}
        <div className="p-3 space-y-1.5">
          {/* Row 1: time-ago  +  status badge */}
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

          {/* Row 2: bold title */}
          <h3 className={`text-[13px] font-bold leading-snug line-clamp-2 ${status === "completed" ? "text-muted-foreground" : "text-foreground"}`}>
            {item.data.topic.trim()}
          </h3>

          {/* Row 3: time range */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="w-2.5 h-2.5" />
              {formatTime(item.data.startTime)} – {formatTime(item.data.endTime)}
            </span>
            {!isVideo && (
              <button
                className="text-[10px] text-amber-400 underline cursor-pointer"
                onClick={handleMaterialOpen}
              >Open</button>
            )}
          </div>
        </div>
      </motion.div>
    </>
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

  if (!isLoading && !isError && videoItems.length === 0) return null;

  return (
    <div className="mb-8">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-primary inline-block" />
          <h2 className="text-base font-bold">Today Classes</h2>
          {liveCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white animate-pulse">
              <Radio className="w-3 h-3" />{liveCount} Live
            </span>
          )}
          {!isLoading && videoItems.length > 0 && (
            <span className="text-xs text-muted-foreground">{videoItems.length} class{videoItems.length !== 1 ? "es" : ""}</span>
          )}
        </div>
        <button onClick={() => refetch()} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Loading skeletons */}
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
          Failed to load today's schedule.
          <button onClick={() => refetch()} className="underline ml-auto cursor-pointer">Retry</button>
        </div>
      )}

      {/* Horizontal scroll row */}
      {!isLoading && !isError && videoItems.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1 snap-x" style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}>
          <AnimatePresence>
            {videoItems.map(item => (
              <div key={item._id} className="snap-start">
                <LiveScheduleCard item={item} />
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="mt-4 border-b border-border/30" />
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
