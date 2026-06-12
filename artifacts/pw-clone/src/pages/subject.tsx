import { useState, useEffect, useRef } from "react";
import { useTopics, useBatchDetails, Topic } from "@/hooks/usePWApi";
import { Layout } from "@/components/layout";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, FileText, PlaySquare, ChevronRight, Layers, Share2, Check } from "lucide-react";

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

  const searchParams = new URLSearchParams(window.location.search);
  const fromMix = searchParams.get("fromMix") ?? "";
  const fromMixName = decodeURIComponent(searchParams.get("fromMixName") ?? "");

  const { data: batchData } = useBatchDetails(batchId!);
  const { allTopics, isLoading, isLoadingMore, isError, refetch } = useAllTopics(batchId!, subjectId!);

  const batchName = batchData?.data.name || "Batch";
  const subjectName = batchData?.data.subjects.find(s => s._id === subjectId)?.subject || "Subject";

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
      <div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-2">Chapters & Topics</h1>
          <p className="text-base sm:text-lg text-muted-foreground">Select a chapter to access lectures and notes.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          className="flex items-center gap-2 self-start md:self-auto"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-500" />
              <span className="text-green-500">Copied!</span>
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              Share
            </>
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="w-full h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {allTopics.map((topic, index) => (
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

          {allTopics.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center p-12 bg-card rounded-xl border border-border/50">
              <Layers className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-bold">No Topics Found</h3>
              <p className="text-muted-foreground">There are no topics available for this subject yet.</p>
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
