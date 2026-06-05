import { useBatchDetails } from "@/hooks/usePWApi";
import { Layout } from "@/components/layout";
import { LazyImage } from "@/components/lazy-image";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, BookOpen, User, PlayCircle } from "lucide-react";

export default function Batch() {
  const { batchId } = useParams<{ batchId: string }>();
  const { data, isLoading, isError, refetch } = useBatchDetails(batchId!);

  if (isError) {
    return (
      <Layout breadcrumbs={[{ label: "Home", href: "/" }, { label: "Error" }]}>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h2 className="text-2xl font-bold">Failed to load subjects</h2>
          <p className="text-muted-foreground max-w-md">
            We couldn't retrieve the batch details. Please check your connection and try again.
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Retry Connection
          </Button>
        </div>
      </Layout>
    );
  }

  const batchName = data?.data.name || "Loading...";

  return (
    <Layout
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: batchName }
      ]}
    >
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Subjects</h1>
        <p className="text-lg text-muted-foreground">Master your concepts subject by subject.</p>
      </div>

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
          {data?.data.subjects.map((subject, index) => (
            <Link key={subject._id} href={`/batch/${batchId}/subject/${subject._id}`}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: index * 0.03 }}
                className="group flex gap-5 p-5 bg-card rounded-xl border border-border/50 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="w-24 h-24 rounded-lg bg-muted overflow-hidden flex-shrink-0 relative">
                  {subject.imageId ? (
                    <LazyImage
                      src={`${subject.imageId.baseUrl}${subject.imageId.key}`}
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
                      <span className="truncate">
                        {subject.teacherIds.map(t => `${t.firstName} ${t.lastName}`).join(", ")}
                      </span>
                    </div>
                  )}

                  <div className="mt-auto flex items-center gap-3">
                    <span className="inline-flex items-center px-2 py-1 rounded bg-secondary text-secondary-foreground text-xs font-medium">
                      <PlayCircle className="w-3 h-3 mr-1" />
                      {subject.lectureCount || 0} Lectures
                    </span>
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}

          {(!data?.data.subjects || data.data.subjects.length === 0) && (
             <div className="col-span-full flex flex-col items-center justify-center p-12 bg-card rounded-xl border border-border/50">
               <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
               <h3 className="text-xl font-bold">No Subjects Found</h3>
               <p className="text-muted-foreground">This batch currently has no published subjects.</p>
             </div>
          )}
        </div>
      )}
    </Layout>
  );
}
