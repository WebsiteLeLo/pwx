import { useState, useEffect, useRef, useCallback } from "react";
import { useBatches } from "@/hooks/usePWApi";
import { useEnrolledBatches } from "@/hooks/useEnrolledBatches";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Calendar,
  GraduationCap,
  Loader2,
  Search,
  BookOpen,
  CheckCircle2,
  X,
} from "lucide-react";
import type { Batch } from "@/hooks/usePWApi";

const PAGE_SIZE = 8;

type Tab = "all" | "enrolled";

function BatchCard({
  batch,
  index,
  enrolled,
  onEnroll,
  onUnenroll,
}: {
  batch: Batch;
  index: number;
  enrolled: boolean;
  onEnroll: (b: Batch) => void;
  onUnenroll: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, delay: (index % PAGE_SIZE) * 0.06 }}
      className="group relative flex flex-col bg-card rounded-xl border border-border/50 overflow-hidden hover:border-primary/50 transition-colors h-full"
      data-testid={`card-batch-${batch._id}`}
    >
      {/* Thumbnail */}
      <Link href={`/batch/${batch._id}`} className="block">
        <div className="relative aspect-video bg-muted overflow-hidden">
          {batch.previewImage ? (
            <img
              src={`${batch.previewImage.baseUrl}${batch.previewImage.key}`}
              alt={batch.name}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://placehold.co/600x400/1a1a1a/00ffff?text=${encodeURIComponent(batch.name)}`;
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-secondary to-background flex items-center justify-center p-6 text-center">
              <span className="font-bold text-lg text-muted-foreground">{batch.name}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
          {enrolled && (
            <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Enrolled
            </div>
          )}
        </div>
      </Link>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
            {batch.language || "English"}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
            {batch.type || "Regular"}
          </span>
        </div>

        <Link href={`/batch/${batch._id}`}>
          <h3 className="font-bold text-lg leading-tight mb-2 line-clamp-2 hover:text-primary transition-colors">
            {batch.name}
          </h3>
        </Link>

        <div className="space-y-2 pt-2">
          <div className="flex items-center text-sm text-muted-foreground gap-2">
            <GraduationCap className="w-4 h-4 shrink-0" />
            <span className="truncate">{batch.byName}</span>
          </div>
          <div className="flex items-center text-sm text-muted-foreground gap-2">
            <Calendar className="w-4 h-4 shrink-0" />
            <span>Started: {new Date(batch.startDate).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Enroll button */}
        <div className="mt-4 pt-4 border-t border-border/40">
          {enrolled ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              onClick={(e) => {
                e.preventDefault();
                onUnenroll(batch._id);
              }}
            >
              <X className="w-4 h-4 mr-1" />
              Unenroll
            </Button>
          ) : (
            <Button
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.preventDefault();
                onEnroll(batch);
              }}
            >
              <BookOpen className="w-4 h-4 mr-1" />
              Enroll
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const { data, isLoading, isError, refetch } = useBatches();
  const { enrolled, enroll, unenroll, isEnrolled } = useEnrolledBatches();

  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  const allBatches = data?.batches ?? [];

  const sourceBatches: Batch[] = tab === "enrolled" ? enrolled : allBatches;

  const filtered = query.trim()
    ? sourceBatches.filter((b) =>
        b.name.toLowerCase().includes(query.toLowerCase()) ||
        b.byName?.toLowerCase().includes(query.toLowerCase())
      )
    : sourceBatches;

  const visibleBatches = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Reset pagination when tab or query changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [tab, query]);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setTimeout(() => {
      setVisibleCount((c) => c + PAGE_SIZE);
      loadingMoreRef.current = false;
    }, 400);
  }, [hasMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  if (isError) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h2 className="text-2xl font-bold">Failed to load batches</h2>
          <p className="text-muted-foreground max-w-md">
            We couldn't reach the content library. Please check your connection and try again.
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Retry Connection
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">
          {tab === "enrolled" ? "My Enrolled Batches" : "Explore Batches"}
        </h1>
        <p className="text-lg text-muted-foreground">
          {tab === "enrolled"
            ? `You have enrolled in ${enrolled.length} batch${enrolled.length !== 1 ? "es" : ""}.`
            : "Select a batch to start your preparation journey."}
        </p>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        {/* Tabs */}
        <div className="flex items-center bg-secondary/50 rounded-lg p-1 gap-1 w-fit">
          <button
            onClick={() => setTab("all")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Batches
            {!isLoading && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({allBatches.length})
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("enrolled")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === "enrolled"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My Batches
            {enrolled.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {enrolled.length}
              </span>
            )}
          </button>
        </div>

        {/* Search bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by batch name or teacher..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Empty state for enrolled tab */}
      {tab === "enrolled" && enrolled.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-4">
          <BookOpen className="w-14 h-14 text-muted-foreground/40" />
          <h2 className="text-xl font-bold">No enrolled batches yet</h2>
          <p className="text-muted-foreground max-w-xs">
            Browse all batches and hit <strong>Enroll</strong> to add them here.
          </p>
          <Button variant="outline" onClick={() => setTab("all")}>
            Browse Batches
          </Button>
        </div>
      )}

      {/* No search results */}
      {query && filtered.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center min-h-[30vh] text-center gap-3">
          <Search className="w-12 h-12 text-muted-foreground/40" />
          <h2 className="text-lg font-semibold">No results for "{query}"</h2>
          <p className="text-muted-foreground text-sm">Try a different name or teacher.</p>
          <Button variant="ghost" size="sm" onClick={() => setQuery("")}>
            Clear search
          </Button>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading && tab === "all"
          ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="w-full aspect-video rounded-xl" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-9 w-full mt-2" />
              </div>
            ))
          : (
            <AnimatePresence>
              {visibleBatches.map((batch, index) => (
                <BatchCard
                  key={batch._id}
                  batch={batch}
                  index={index}
                  enrolled={isEnrolled(batch._id)}
                  onEnroll={enroll}
                  onUnenroll={unenroll}
                />
              ))}
            </AnimatePresence>
          )}
      </div>

      {/* Sentinel + loading spinner */}
      <div ref={sentinelRef} className="flex justify-center py-10">
        {!isLoading && hasMore && (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        )}
      </div>
    </Layout>
  );
}
