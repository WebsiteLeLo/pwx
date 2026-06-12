import { useState, useEffect, useRef } from "react";
import { useTopics, useBatchDetails, Topic } from "@/hooks/usePWApi";
import { Layout } from "@/components/layout";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, FileText, PlaySquare, ChevronRight, Layers, Share2, Check, Search, X } from "lucide-react";

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

  const searchParams = new URLSearchParams(window.location.search);
  const fromMix = searchParams.get("fromMix") ?? "";
  const fromMixName = decodeURIComponent(searchParams.get("fromMixName") ?? "");

  const { data: batchData } = useBatchDetails(batchId!);
  const { allTopics, isLoading, isLoadingMore, isError, refetch } = useAllTopics(batchId!, subjectId!);

  const batchName = batchData?.data.name || "Batch";
  const subjectName = batchData?.data.subjects.find(s => s._id === subjectId)?.subject || "Subject";

  const filteredTopics = search.trim()
    ? allTopics.filter(t => t.name.toLowerCase().includes(search.trim().toLowerCase()))
    : allTopics;

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
    try {
      if (navigator.share) {
        await navigator.share({ title: subjectName, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
      <div className="flex items-start justify-between gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-1">Chapters & Topics</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Select a chapter to access lectures and notes.</p>
        </div>
        <button
          onClick={handleShare}
          title="Share this page"
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all flex-shrink-0 mt-1
            ${copied
              ? "border-green-500/60 bg-green-500/10 text-green-400"
              : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
            }`}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span className="hidden sm:inline">Copied!</span>
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </>
          )}
        </button>
      </div>

      {/* Search bar */}
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

      {/* Topics list */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="w-full h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTopics.map((topic, index) => (
            <Link key={topic._id} href={topicHref(topic._id)}>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(index * 0.03, 0.3) }}
                className="group flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-card rounded-xl border border-border/50 hover:border-primary/50 hover:bg-card/80 transition-all cursor-pointer"
              >
                <div className="flex items-start gap-4 mb-4 sm:mb-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-1">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                      {topic.name}
                    </h3>
                    <div className="text-sm text-muted-foreground mt-1">
                      Chapter • Index {topic.displayOrder}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-14 sm:ml-0">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium">
                    <PlaySquare className="w-4 h-4 text-primary" />
                    <span>{topic.videos || topic.lectureVideos || 0} Videos</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium">
                    <FileText className="w-4 h-4 text-accent" />
                    <span>{topic.notes || 0} Notes</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground ml-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0" />
                </div>
              </motion.div>
            </Link>
          ))}

          {filteredTopics.length === 0 && !isLoading && (
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
