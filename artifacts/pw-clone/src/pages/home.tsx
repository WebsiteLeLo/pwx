import { useState, useEffect, useRef, useCallback } from "react";
import { useBatches } from "@/hooks/usePWApi";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, Calendar, GraduationCap, Loader2 } from "lucide-react";

const PAGE_SIZE = 8;

export default function Home() {
  const { data, isLoading, isError, refetch } = useBatches();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  const allBatches = data?.batches ?? [];
  const visibleBatches = allBatches.slice(0, visibleCount);
  const hasMore = visibleCount < allBatches.length;

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
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
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
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Explore Batches</h1>
        <p className="text-lg text-muted-foreground">Select a batch to start your preparation journey.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading
          ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="w-full aspect-video rounded-xl" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))
          : visibleBatches.map((batch, index) => (
              <Link key={batch._id} href={`/batch/${batch._id}`}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: (index % PAGE_SIZE) * 0.06 }}
                  className="group relative flex flex-col bg-card rounded-xl border border-border/50 overflow-hidden hover:border-primary/50 transition-colors h-full"
                  data-testid={`card-batch-${batch._id}`}
                >
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
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                        {batch.language || "English"}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                        {batch.type || "Regular"}
                      </span>
                    </div>

                    <h3 className="font-bold text-lg leading-tight mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                      {batch.name}
                    </h3>

                    <div className="mt-auto space-y-2 pt-4">
                      <div className="flex items-center text-sm text-muted-foreground gap-2">
                        <GraduationCap className="w-4 h-4" />
                        <span>{batch.byName}</span>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>Started: {new Date(batch.startDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
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
