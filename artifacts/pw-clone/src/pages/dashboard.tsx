import { usePageMeta } from "@/hooks/usePageMeta";
import { Layout } from "@/components/layout";
import { useCompletedItems, MAX_STAGE } from "@/hooks/useCompletedItems";
import { useEnrolledBatches } from "@/hooks/useEnrolledBatches";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  BarChart2, Play, FileText, CheckCircle2, Brain,
  GraduationCap, Trophy, BookOpen, ChevronRight,
  Flame, TrendingUp, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── helpers ───────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center gap-2 py-5 rounded-2xl border ${color}`}
    >
      {icon}
      <span className="text-3xl font-extrabold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </motion.div>
  );
}

function BatchProgressBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max === 0 ? 0 : Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  usePageMeta({
    title: "Progress Dashboard | PWX",
    description: "Track your lecture and DPP completion across all enrolled batches.",
    canonical: "/dashboard",
  });

  const { items, getDueNow, getMastered } = useCompletedItems();
  const { enrolled } = useEnrolledBatches();

  // ── global stats ─────────────────────────────────────────────────────────
  const totalVideos   = items.filter((i) => i.type === "video").length;
  const totalDpps     = items.filter((i) => i.type === "dpp").length;
  const totalDue      = getDueNow().length;
  const totalMastered = getMastered().length;

  // ── per-batch stats ───────────────────────────────────────────────────────
  const batchMap: Record<string, { videos: number; dpps: number }> = {};
  items.forEach((item) => {
    if (!batchMap[item.batchId]) batchMap[item.batchId] = { videos: 0, dpps: 0 };
    if (item.type === "video") batchMap[item.batchId].videos++;
    else batchMap[item.batchId].dpps++;
  });

  const maxVideos = Math.max(1, ...Object.values(batchMap).map((s) => s.videos));
  const maxDpps   = Math.max(1, ...Object.values(batchMap).map((s) => s.dpps));

  // Sort: batches with most progress first, then enrolled-only ones
  const sorted = [...enrolled].sort((a, b) => {
    const aT = (batchMap[a._id]?.videos ?? 0) + (batchMap[a._id]?.dpps ?? 0);
    const bT = (batchMap[b._id]?.videos ?? 0) + (batchMap[b._id]?.dpps ?? 0);
    return bT - aT;
  });

  const hasAnyProgress = totalVideos + totalDpps > 0;

  return (
    <Layout breadcrumbs={[{ label: "Home", href: "/" }, { label: "Dashboard" }]}>
      {/* ── Header ── */}
      <div className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <BarChart2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Progress Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your overall learning progress across all batches</p>
        </div>
      </div>

      {/* ── Empty state ── */}
      {enrolled.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-5">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
            <Target className="w-10 h-10 text-primary/40" />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-2">No batches enrolled</h2>
            <p className="text-muted-foreground text-sm max-w-xs">
              Enroll in batches from the home page, then mark lectures and DPPs done to track progress here.
            </p>
          </div>
          <Link href="/"><Button variant="outline">Browse Batches <ChevronRight className="w-4 h-4 ml-1" /></Button></Link>
        </div>
      )}

      {enrolled.length > 0 && (
        <>
          {/* ── Global stat cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
            <StatCard
              icon={<Play className="w-5 h-5 text-primary" />}
              label="Lectures Done"
              value={totalVideos}
              color="bg-primary/5 border-primary/20"
            />
            <StatCard
              icon={<FileText className="w-5 h-5 text-orange-400" />}
              label="DPPs Done"
              value={totalDpps}
              color="bg-orange-500/5 border-orange-500/20"
            />
            <StatCard
              icon={<Flame className="w-5 h-5 text-red-400" />}
              label="Due for Revision"
              value={totalDue}
              color={totalDue > 0 ? "bg-red-500/5 border-red-500/30" : "bg-secondary border-border/40"}
            />
            <StatCard
              icon={<Trophy className="w-5 h-5 text-green-500" />}
              label="Mastered"
              value={totalMastered}
              color="bg-green-500/5 border-green-500/20"
            />
          </div>

          {/* ── Quick actions ── */}
          {hasAnyProgress && (
            <div className="flex flex-wrap gap-3 mb-10">
              <Link href="/revision">
                <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all">
                  <Brain className="w-4 h-4" />
                  Open Revision Queue
                  {totalDue > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {totalDue}
                    </span>
                  )}
                </button>
              </Link>
            </div>
          )}

          {/* ── No progress yet ── */}
          {!hasAnyProgress && (
            <div className="mb-8 p-4 rounded-2xl border border-dashed border-border/60 bg-muted/30 flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Start watching lectures and mark them done — your progress will appear here.
              </p>
            </div>
          )}

          {/* ── Per-batch table ── */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-base font-bold">Batch-wise Progress</h2>
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                {enrolled.length} enrolled
              </span>
            </div>

            <div className="space-y-3">
              {sorted.map((batch, idx) => {
                const s = batchMap[batch._id] ?? { videos: 0, dpps: 0 };
                const total = s.videos + s.dpps;
                const hasProgress = total > 0;

                return (
                  <motion.div
                    key={batch._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`rounded-2xl border bg-card overflow-hidden transition-colors hover:border-primary/40 ${
                      hasProgress ? "border-border/60" : "border-border/30 opacity-60"
                    }`}
                  >
                    <div className="p-4 sm:p-5">
                      {/* Batch name row */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <Link href={`/batch/${batch._id}`}>
                          <h3 className="font-bold text-sm leading-snug hover:text-primary transition-colors cursor-pointer line-clamp-1">
                            {batch.name}
                          </h3>
                        </Link>
                        {hasProgress ? (
                          <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            {total} done
                          </span>
                        ) : (
                          <span className="flex-shrink-0 text-[10px] text-muted-foreground px-2 py-1 rounded-full bg-muted border border-border/40">
                            Not started
                          </span>
                        )}
                      </div>

                      {/* Stats + bars */}
                      <div className="grid grid-cols-2 gap-4 sm:gap-6">
                        {/* Lectures */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Play className="w-3 h-3 text-primary fill-current" />
                            </div>
                            <div>
                              <span className="text-xl font-extrabold leading-none">{s.videos}</span>
                              <span className="text-[10px] text-muted-foreground ml-1">lectures</span>
                            </div>
                          </div>
                          <BatchProgressBar
                            label="vs best batch"
                            value={s.videos}
                            max={maxVideos}
                            color="bg-primary"
                          />
                        </div>

                        {/* DPPs */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-md bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-3 h-3 text-orange-400" />
                            </div>
                            <div>
                              <span className="text-xl font-extrabold leading-none">{s.dpps}</span>
                              <span className="text-[10px] text-muted-foreground ml-1">DPPs</span>
                            </div>
                          </div>
                          <BatchProgressBar
                            label="vs best batch"
                            value={s.dpps}
                            max={maxDpps}
                            color="bg-orange-400"
                          />
                        </div>
                      </div>

                      {/* Revision stage indicator if items exist */}
                      {hasProgress && (() => {
                        const batchItems = items.filter((i) => i.batchId === batch._id);
                        const avgStage = batchItems.reduce((acc, i) => acc + i.revisionStage, 0) / batchItems.length;
                        const mastered = batchItems.filter((i) => i.revisionStage >= MAX_STAGE).length;
                        return (
                          <div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Brain className="w-3 h-3" />
                              Avg revision stage:
                              <span className="font-semibold text-foreground">
                                {avgStage.toFixed(1)}/{MAX_STAGE}
                              </span>
                            </div>
                            {mastered > 0 && (
                              <div className="flex items-center gap-1.5 text-xs text-green-500">
                                <GraduationCap className="w-3 h-3" />
                                {mastered} mastered
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </Layout>
  );
}
