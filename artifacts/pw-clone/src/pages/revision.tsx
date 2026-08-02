import { useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Layout } from "@/components/layout";
import { useCompletedItems, MAX_STAGE, REVISION_INTERVALS, type CompletedItem, type RevisionQuality } from "@/hooks/useCompletedItems";
import { useEnrolledBatches } from "@/hooks/useEnrolledBatches";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  Brain, Play, FileText, CheckCircle2, Clock, RotateCcw,
  BookOpen, ChevronRight, Zap, GraduationCap, CalendarClock,
  Flame, Trophy, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── helpers ──────────────────────────────────────────────────────────────────

const STAGE_LABELS = ["1 day", "3 days", "7 days", "14 days", "30 days"];

function formatDue(ts: number): string {
  const diff = ts - Date.now();
  const absDiff = Math.abs(diff);
  const days = Math.floor(absDiff / (24 * 60 * 60 * 1000));
  const hours = Math.floor(absDiff / (60 * 60 * 1000));
  const mins = Math.floor(absDiff / (60 * 1000));

  if (diff < 0) {
    if (days > 0) return `${days}d overdue`;
    if (hours > 0) return `${hours}h overdue`;
    return `${mins}m overdue`;
  }
  if (days > 0) return `in ${days}d`;
  if (hours > 0) return `in ${hours}h`;
  return `in ${mins}m`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function StageDots({ stage }: { stage: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: MAX_STAGE }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-all ${
            i < stage
              ? "bg-primary scale-110"
              : "bg-border"
          }`}
        />
      ))}
    </div>
  );
}

// ── Quick Recall Card ─────────────────────────────────────────────────────────

function QuickRecall({
  item,
  onDone,
}: {
  item: CompletedItem;
  onDone: () => void;
}) {
  const { markRevised } = useCompletedItems();
  const [result, setResult] = useState<RevisionQuality | null>(null);

  const handle = (q: RevisionQuality) => {
    markRevised(item.id, q);
    setResult(q);
    setTimeout(onDone, 1400);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="rounded-2xl border border-primary/30 bg-primary/5 p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold text-primary uppercase tracking-wide">Quick Recall</span>
      </div>

      <p className="font-bold text-base mb-1 leading-snug">{item.title}</p>
      <p className="text-sm text-muted-foreground mb-5">
        Can you recall the key concepts from this {item.type === "video" ? "lecture" : "DPP"}?
      </p>

      {!result ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => handle("yes")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-green-500/15 text-green-500 border border-green-500/30 hover:bg-green-500/25 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            Yes, got it!
          </button>
          <button
            onClick={() => handle("partial")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30 hover:bg-amber-500/25 transition-all"
          >
            <Zap className="w-4 h-4" />
            Sort of
          </button>
          <button
            onClick={() => handle("no")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Forgot
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold ${
            result === "yes"
              ? "bg-green-500/15 text-green-500"
              : result === "partial"
              ? "bg-amber-500/15 text-amber-500"
              : "bg-red-500/15 text-red-400"
          }`}
        >
          {result === "yes" ? (
            <><CheckCircle2 className="w-4 h-4" /> Stage advanced! 🎉</>
          ) : result === "partial" ? (
            <><Zap className="w-4 h-4" /> Scheduled for a shorter interval</>
          ) : (
            <><RotateCcw className="w-4 h-4" /> Dropped a stage — practice more</>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Due Item Card ─────────────────────────────────────────────────────────────

function DueCard({
  item,
  batchName,
}: {
  item: CompletedItem;
  batchName: string;
}) {
  const [recalling, setRecalling] = useState(false);
  const isOverdue = item.nextRevisionAt < Date.now();

  const watchUrl = item.subjectId && item.topicId
    ? `/watch?batchId=${item.batchId}&subjectId=${item.subjectId}&topicId=${item.topicId}&videoId=${item.id}&title=${encodeURIComponent(item.title)}`
    : null;

  const notesUrl = item.subjectId && item.topicId
    ? `/batch/${item.batchId}/subject/${item.subjectId}/topic/${item.topicId}`
    : item.subjectId
    ? `/batch/${item.batchId}/subject/${item.subjectId}`
    : `/batch/${item.batchId}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`rounded-2xl border bg-card overflow-hidden ${
        isOverdue ? "border-red-500/40" : "border-orange-500/30"
      }`}
    >
      {/* Top accent bar */}
      <div className={`h-1 w-full ${isOverdue ? "bg-red-500" : "bg-orange-400"}`} />

      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isOverdue
                  ? "bg-red-500/15 text-red-400"
                  : "bg-orange-500/15 text-orange-400"
              }`}>
                {formatDue(item.nextRevisionAt)}
              </span>
              <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                {item.type === "video" ? "Lecture" : "DPP"}
              </span>
            </div>
            <h3 className="font-bold text-sm leading-snug line-clamp-2">{item.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{batchName}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <StageDots stage={item.revisionStage} />
            <span className="text-[10px] text-muted-foreground">
              Stage {item.revisionStage}/{MAX_STAGE}
            </span>
          </div>
        </div>

        {/* Revision method buttons */}
        <AnimatePresence mode="wait">
          {recalling ? (
            <QuickRecall
              key="recall"
              item={item}
              onDone={() => setRecalling(false)}
            />
          ) : (
            <motion.div
              key="methods"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex gap-2 flex-wrap"
            >
              {/* Re-watch */}
              {item.type === "video" && watchUrl && (
                <Link href={watchUrl}>
                  <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all">
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Re-watch
                  </button>
                </Link>
              )}

              {/* View Notes */}
              <Link href={notesUrl}>
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 transition-all">
                  <FileText className="w-3.5 h-3.5" />
                  {item.type === "dpp" ? "View DPP" : "Notes"}
                </button>
              </Link>

              {/* Quick Recall */}
              <button
                onClick={() => setRecalling(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all"
              >
                <Brain className="w-3.5 h-3.5" />
                Quick Recall
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Completed & last revised info */}
        <div className="flex items-center gap-3 pt-1 border-t border-border/30">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            Completed {timeAgo(item.completedAt)}
          </span>
          {item.lastRevisedAt && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              Revised {timeAgo(item.lastRevisedAt)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Upcoming row ──────────────────────────────────────────────────────────────

function UpcomingRow({ item, batchName }: { item: CompletedItem; batchName: string }) {
  const daysUntil = Math.ceil((item.nextRevisionAt - Date.now()) / (24 * 60 * 60 * 1000));
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-card border border-border/40 hover:border-border transition-colors"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        item.type === "video" ? "bg-primary/10" : "bg-orange-500/10"
      }`}>
        {item.type === "video"
          ? <Play className="w-3.5 h-3.5 text-primary fill-current" />
          : <FileText className="w-3.5 h-3.5 text-orange-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground truncate">{batchName}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <StageDots stage={item.revisionStage} />
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          daysUntil <= 2
            ? "bg-orange-500/10 text-orange-400"
            : "bg-secondary text-muted-foreground"
        }`}>
          {daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`}
        </span>
      </div>
    </motion.div>
  );
}

// ── Mastered row ──────────────────────────────────────────────────────────────

function MasteredRow({ item, batchName }: { item: CompletedItem; batchName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-card border border-green-500/20 opacity-70"
    >
      <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
        <GraduationCap className="w-3.5 h-3.5 text-green-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate line-through text-muted-foreground">{item.title}</p>
        <p className="text-xs text-muted-foreground truncate">{batchName}</p>
      </div>
      <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1">
        <Trophy className="w-2.5 h-2.5" />
        Mastered
      </span>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RevisionPage() {
  usePageMeta({
    title: "Smart Revision Queue | PWX",
    description: "Revise completed lectures using spaced repetition. Re-watch, view notes, or do a quick recall.",
    canonical: "/revision",
  });

  const { getDueNow, getUpcoming, getMastered, items } = useCompletedItems();
  const { enrolled } = useEnrolledBatches();

  const batchNameMap = Object.fromEntries(enrolled.map((b) => [b._id, b.name]));
  const getBatchName = (batchId: string) => batchNameMap[batchId] ?? "Unknown Batch";

  const due = getDueNow();
  const upcoming = getUpcoming();
  const mastered = getMastered();

  const totalItems = items.length;
  const dueCount = due.length;
  const masteredCount = mastered.length;

  return (
    <Layout breadcrumbs={[{ label: "Home", href: "/" }, { label: "Revision Queue" }]}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Smart Revision Queue</h1>
            <p className="text-sm text-muted-foreground">Spaced repetition — revise at the right time</p>
          </div>
        </div>

        {/* Stats strip */}
        {totalItems > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-1 py-3 rounded-xl bg-red-500/8 border border-red-500/20">
              <Flame className="w-4 h-4 text-red-400" />
              <span className="text-xl font-bold">{dueCount}</span>
              <span className="text-[10px] text-muted-foreground">Due Now</span>
            </div>
            <div className="flex flex-col items-center gap-1 py-3 rounded-xl bg-secondary border border-border/40">
              <CalendarClock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xl font-bold">{upcoming.length}</span>
              <span className="text-[10px] text-muted-foreground">Upcoming</span>
            </div>
            <div className="flex flex-col items-center gap-1 py-3 rounded-xl bg-green-500/8 border border-green-500/20">
              <Trophy className="w-4 h-4 text-green-500" />
              <span className="text-xl font-bold">{masteredCount}</span>
              <span className="text-[10px] text-muted-foreground">Mastered</span>
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {totalItems === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-5">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-10 h-10 text-primary/40" />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-2">Nothing to revise yet</h2>
            <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
              Mark videos and DPPs as done from any batch topic page.
              They'll show up here for revision after 1 day.
            </p>
          </div>
          <Link href="/">
            <Button variant="outline">
              Browse Batches
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      )}

      {/* ── Due Now ── */}
      {due.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-red-400" />
            <h2 className="text-base font-bold">Due Now</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">
              {due.length}
            </span>
          </div>
          <div className="space-y-3">
            <AnimatePresence>
              {due.map((item) => (
                <DueCard
                  key={item.id}
                  item={item}
                  batchName={getBatchName(item.batchId)}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* ── All caught up ── */}
      {totalItems > 0 && due.length === 0 && (
        <div className="mb-8 flex items-center gap-3 p-4 rounded-2xl border border-green-500/30 bg-green-500/5">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm text-green-500">All caught up!</p>
            <p className="text-xs text-muted-foreground">No revisions due right now. Check back soon.</p>
          </div>
        </div>
      )}

      {/* ── Upcoming ── */}
      {upcoming.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-base font-bold">Upcoming</h2>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {upcoming.length}
            </span>
          </div>

          {/* Stage legend */}
          <div className="flex flex-wrap gap-2 mb-3">
            {REVISION_INTERVALS.map((_, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary" />
                Stage {i + 1} — {STAGE_LABELS[i]}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <AnimatePresence>
              {upcoming.map((item) => (
                <UpcomingRow
                  key={item.id}
                  item={item}
                  batchName={getBatchName(item.batchId)}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* ── Mastered ── */}
      {mastered.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="w-4 h-4 text-green-500" />
            <h2 className="text-base font-bold">Mastered</h2>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {mastered.length}
            </span>
          </div>
          <div className="space-y-2">
            <AnimatePresence>
              {mastered.map((item) => (
                <MasteredRow
                  key={item.id}
                  item={item}
                  batchName={getBatchName(item.batchId)}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}
    </Layout>
  );
}
