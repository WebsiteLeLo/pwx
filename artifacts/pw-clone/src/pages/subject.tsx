import { useState, useEffect, useRef } from "react";
import { useTopics, useBatchDetails, Topic } from "@/hooks/usePWApi";
import { usePinnedChapters } from "@/hooks/usePinnedChapters";
import { useChapterOrder } from "@/hooks/useChapterOrder";
import { Layout } from "@/components/layout";
import { Link, useParams } from "wouter";
import { motion, AnimatePresence, useMotionValue, useTransform, animate, Reorder, useDragControls } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, FileText, PlaySquare, ChevronRight, Layers, Share2, Check, Search, X, Pin, PinOff, GripVertical, ArrowUpDown, RotateCcw, CalendarDays } from "lucide-react";

const SWIPE_THRESHOLD = 80;

function SwipeToPin({
  pinned,
  onToggle,
  children,
}: {
  pinned: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [0, SWIPE_THRESHOLD * 0.3, SWIPE_THRESHOLD], [0, 0.5, 1]);
  const iconScale = useTransform(x, [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD], [0.4, 0.75, 1]);
  const labelOpacity = useTransform(x, [SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD], [0, 1]);

  const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x >= SWIPE_THRESHOLD) {
      onToggle();
    }
    animate(x, 0, { type: "spring", stiffness: 500, damping: 38 });
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Reveal layer shown as the row slides right */}
      <motion.div
        style={{ opacity: bgOpacity }}
        className={`absolute inset-0 flex items-center gap-2 pl-6 pointer-events-none ${
          pinned ? "bg-red-500/20" : "bg-amber-500/20"
        }`}
      >
        <motion.div style={{ scale: iconScale }} className="flex items-center gap-2">
          {pinned
            ? <PinOff className="w-5 h-5 text-red-400 flex-shrink-0" />
            : <Pin className="w-5 h-5 text-amber-400 fill-current flex-shrink-0" />}
          <motion.span
            style={{ opacity: labelOpacity }}
            className={`text-sm font-semibold ${pinned ? "text-red-400" : "text-amber-400"}`}
          >
            {pinned ? "Unpin" : "Pin"}
          </motion.span>
        </motion.div>
      </motion.div>

      {/* Draggable row (right-only, snaps back) */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: SWIPE_THRESHOLD * 1.5 }}
        dragElastic={{ left: 0, right: 0.25 }}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={handleDragEnd}
        className="relative touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
}

function ReorderItem({ topic, pinned }: { topic: Topic; pinned: boolean }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      key={topic._id}
      value={topic}
      dragListener={false}
      dragControls={controls}
      className="list-none"
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 32px rgba(0,0,0,0.35)", zIndex: 50 }}
    >
      <div className="flex items-center gap-2 bg-card border border-border/60 rounded-xl select-none">
        <div
          className="pl-3 py-4 text-muted-foreground flex-shrink-0 touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => { e.preventDefault(); controls.start(e); }}
        >
          <GripVertical className="w-5 h-5" />
        </div>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${pinned ? "bg-amber-500/15 text-amber-400" : "bg-primary/10 text-primary"}`}>
          {pinned ? <Pin className="w-3.5 h-3.5 fill-current" /> : <Layers className="w-3.5 h-3.5" />}
        </div>
        <div className="flex-1 min-w-0 py-4 pr-4">
          <p className="font-semibold text-sm leading-snug truncate">{topic.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <PlaySquare className="w-3 h-3 text-primary" />
              {topic.videos || topic.lectureVideos || 0}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="w-3 h-3" />
              {topic.notes || 0}
            </span>
            {pinned && <span className="text-xs text-amber-400 font-medium">Pinned</span>}
          </div>
        </div>
      </div>
    </Reorder.Item>
  );
}

const MAX_PAGES = 50;

function useAllTopics(batchId: string, subjectId: string) {
  const [fetchPage, setFetchPage] = useState(1);
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [done, setDone] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    setFetchPage(1);
    setAllTopics([]);
    setDone(false);
    seenIds.current = new Set();
  }, [batchId, subjectId]);

  const { data, isLoading, isError, refetch } = useTopics(batchId, subjectId, fetchPage);

  useEffect(() => {
    if (!data) return;
    const incoming = data.data ?? [];
    const fresh = incoming.filter(t => !seenIds.current.has(t._id));
    fresh.forEach(t => seenIds.current.add(t._id));

    if (fresh.length > 0) {
      setAllTopics(prev => [...prev, ...fresh]);
      if (fetchPage < MAX_PAGES) {
        setFetchPage(p => p + 1);
      } else {
        setDone(true);
      }
    } else {
      setDone(true);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLoadingMore = !done && (isLoading || fetchPage > 1);

  return { allTopics, isLoading: isLoading && allTopics.length === 0, isLoadingMore, isError, done, refetch };
}

export default function Subject() {
  const { batchId, subjectId } = useParams<{ batchId: string; subjectId: string }>();
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [reorderMode, setReorderMode] = useState(false);
  const { isPinned, toggle } = usePinnedChapters();

  const searchParams = new URLSearchParams(window.location.search);
  const fromMix = searchParams.get("fromMix") ?? "";
  const fromMixName = decodeURIComponent(searchParams.get("fromMixName") ?? "");

  const { data: batchData } = useBatchDetails(batchId!);
  const { allTopics, isLoading, isLoadingMore, isError, refetch } = useAllTopics(batchId!, subjectId!);

  const batchName = batchData?.data.name || "Batch";
  const subjectName = batchData?.data.subjects.find(s => s._id === subjectId)?.subject || "Subject";

  const { orderedTopics, saveOrder, resetOrder, hasCustomOrder } = useChapterOrder(subjectId!, allTopics);

  const displayTopics = reorderMode
    ? orderedTopics
    : search.trim()
      ? orderedTopics.filter(t => t.name.toLowerCase().includes(search.trim().toLowerCase()))
      : orderedTopics;

  const breadcrumbs = fromMix
    ? [
        { label: "Home", href: "/" },
        { label: "My Mix", href: "/my-mix" },
        { label: fromMixName || "Mix", href: `/my-mix/${fromMix}` },
        { label: subjectName },
      ]
    : [
        { label: "Home", href: "/" },
        { label: batchName, href: `/batch/${batchId}` },
        { label: subjectName },
      ];

  const topicHref = (topicId: string) => {
    const base = `/batch/${batchId}/subject/${subjectId}/topic/${topicId}`;
    return fromMix
      ? `${base}?fromMix=${fromMix}&fromMixName=${encodeURIComponent(fromMixName)}&fromMixSubject=${encodeURIComponent(subjectName)}`
      : base;
  };

  const handleShare = async () => {
    const url = window.location.href;
    const fallbackCopy = () => {
      const el = document.createElement("textarea");
      el.value = url;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    try {
      if (navigator.share) {
        await navigator.share({ title: subjectName, url });
      } else if (navigator.clipboard && document.hasFocus()) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        fallbackCopy();
      }
    } catch {
      fallbackCopy();
    }
  };

  if (isError && allTopics.length === 0) {
    return (
      <Layout breadcrumbs={[{ label: "Home", href: "/" }, { label: "Error" }]}>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h2 className="text-2xl font-bold">Failed to load topics</h2>
          <p className="text-muted-foreground max-w-md">
            We couldn't retrieve the topics for this subject. Please check your connection and try again.
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Retry Connection
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout breadcrumbs={breadcrumbs}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-xl font-bold tracking-tight">Chapters</h1>
          {hasCustomOrder && !reorderMode && (
            <button
              onClick={resetOrder}
              title="Reset to original order"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border/50 rounded-lg px-2 py-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => { setReorderMode(m => !m); setSearch(""); }}
            title={reorderMode ? "Done reordering" : "Reorder chapters"}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
              reorderMode
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{reorderMode ? "Done" : "Reorder"}</span>
          </button>
          {!reorderMode && (
            <>
              <Link
                href={`/batch/${batchId}/subject/${subjectId}/calendar`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-border text-sm font-medium transition-all"
                title="View lecture calendar"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Calendar</span>
              </Link>
              <button
                onClick={handleShare}
                title="Share this page"
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                  copied
                    ? "border-green-500/60 bg-green-500/10 text-green-400"
                    : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span className="hidden sm:inline">{copied ? "Copied!" : "Share"}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Reorder hint banner */}
      <AnimatePresence>
        {reorderMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/25 text-sm text-primary">
              <GripVertical className="w-4 h-4 flex-shrink-0" />
              Drag the handle to reorder chapters. Tap Done when finished.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search bar — hidden in reorder mode */}
      {!reorderMode && (
        <div className="relative mb-5 sm:mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search chapters..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border/60 bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Topics list */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="w-full h-24 rounded-xl" />
          ))}
        </div>
      ) : reorderMode ? (
        /* ── REORDER MODE: drag-and-drop list ── */
        <Reorder.Group
          axis="y"
          values={displayTopics}
          onReorder={saveOrder}
          className="space-y-3"
          style={{ overflowY: "visible" }}
        >
          {displayTopics.map((topic) => (
            <ReorderItem key={topic._id} topic={topic} pinned={isPinned(topic._id)} />
          ))}
        </Reorder.Group>
      ) : (
        /* ── NORMAL MODE: swipe-to-pin list ── */
        <div className="space-y-3">
          {displayTopics.map((topic, index) => {
            const pinned = isPinned(topic._id);
            const topicData = {
              topicId: topic._id,
              topicName: topic.name,
              batchId: batchId!,
              batchName,
              subjectId: subjectId!,
              subjectName,
              href: topicHref(topic._id),
              videoCount: topic.videos || topic.lectureVideos || 0,
              noteCount: topic.notes || 0,
            };
            return (
              <motion.div
                key={topic._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(index * 0.03, 0.3) }}
              >
                <SwipeToPin pinned={pinned} onToggle={() => toggle(topicData)}>
                  <div className="group flex items-center bg-card border border-border/50 hover:border-primary/50 hover:bg-card/80 transition-all rounded-xl">
                    <Link href={topicHref(topic._id)} className="flex-1 flex items-center gap-3 p-4 cursor-pointer min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${pinned ? "bg-amber-500/15 text-amber-400" : "bg-primary/10 text-primary"}`}>
                        {pinned ? <Pin className="w-4 h-4 fill-current" /> : <Layers className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors truncate">
                          {topic.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <PlaySquare className="w-3 h-3 text-primary" />
                            {topic.videos || topic.lectureVideos || 0}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <FileText className="w-3 h-3" />
                            {topic.notes || 0}
                          </span>
                          {pinned && <span className="text-xs text-amber-400 font-medium">Pinned</span>}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </Link>
                    <button
                      onClick={(e) => { e.preventDefault(); toggle(topicData); }}
                      title={pinned ? "Unpin chapter" : "Pin for quick access"}
                      className={`mr-3 p-1.5 rounded-lg border transition-all ${
                        pinned
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                          : "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-muted opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {pinned ? (
                          <motion.span key="pinned" initial={{ scale: 0.7 }} animate={{ scale: 1 }} exit={{ scale: 0.7 }}>
                            <PinOff className="w-4 h-4" />
                          </motion.span>
                        ) : (
                          <motion.span key="unpinned" initial={{ scale: 0.7 }} animate={{ scale: 1 }} exit={{ scale: 0.7 }}>
                            <Pin className="w-4 h-4" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  </div>
                </SwipeToPin>
              </motion.div>
            );
          })}

          {displayTopics.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center p-12 bg-card rounded-xl border border-border/50">
              <Layers className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-bold">
                {search ? "No chapters found" : "No Topics Found"}
              </h3>
              <p className="text-muted-foreground">
                {search ? `No chapters match "${search}"` : "There are no topics available for this subject yet."}
              </p>
              {search && (
                <button onClick={() => setSearch("")} className="mt-3 text-sm text-primary hover:underline">
                  Clear search
                </button>
              )}
            </div>
          )}

          {isLoadingMore && (
            <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              Loading more topics…
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
