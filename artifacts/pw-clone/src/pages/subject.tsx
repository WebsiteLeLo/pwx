import { useState } from "react";
import { useTopics, useBatchDetails } from "@/hooks/usePWApi";
import { Layout } from "@/components/layout";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, FileText, PlaySquare, ChevronLeft, ChevronRight, Layers } from "lucide-react";

export default function Subject() {
  const { batchId, subjectId } = useParams<{ batchId: string; subjectId: string }>();
  const [page, setPage] = useState(1);

  // Fetch batch details just to get the names for breadcrumbs (optional, but good UX)
  const { data: batchData } = useBatchDetails(batchId!);
  const { data, isLoading, isError, refetch } = useTopics(batchId!, subjectId!, page);

  const batchName = batchData?.data.name || "Batch";
  const subjectName = batchData?.data.subjects.find(s => s._id === subjectId)?.subject || "Subject";

  if (isError) {
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

  const totalPages = data ? Math.ceil(data.paginate.totalCount / data.paginate.limit) : 0;

  return (
    <Layout
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: batchName, href: `/batch/${batchId}` },
        { label: subjectName }
      ]}
    >
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Chapters & Topics</h1>
          <p className="text-lg text-muted-foreground">Select a chapter to access lectures and notes.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="w-full h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {data?.data.map((topic, index) => (
            <Link key={topic._id} href={`/batch/${batchId}/subject/${subjectId}/topic/${topic._id}`}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
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

          {(!data?.data || data.data.length === 0) && (
             <div className="flex flex-col items-center justify-center p-12 bg-card rounded-xl border border-border/50">
               <Layers className="w-12 h-12 text-muted-foreground mb-4" />
               <h3 className="text-xl font-bold">No Topics Found</h3>
               <p className="text-muted-foreground">There are no topics available for this subject yet.</p>
             </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              <span className="text-sm font-medium">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
