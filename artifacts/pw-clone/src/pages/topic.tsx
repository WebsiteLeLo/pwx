import { useTopicContents, useBatchDetails, useTopics } from "@/hooks/usePWApi";
import { Layout } from "@/components/layout";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, Play, FileText, Clock, CalendarDays } from "lucide-react";

export default function Topic() {
  const { batchId, subjectId, topicId } = useParams<{ batchId: string; subjectId: string; topicId: string }>();

  // Fetch parents for breadcrumbs
  const { data: batchData } = useBatchDetails(batchId!);
  const { data: topicsData } = useTopics(batchId!, subjectId!, 1);
  const { data, isLoading, isError, refetch } = useTopicContents(batchId!, subjectId!, topicId!);

  const batchName = batchData?.data.name || "Batch";
  const subjectName = batchData?.data.subjects.find(s => s._id === subjectId)?.subject || "Subject";
  const topicName = topicsData?.data.find(t => t._id === topicId)?.name || "Topic";

  if (isError) {
    return (
      <Layout breadcrumbs={[{ label: "Home", href: "/" }, { label: "Error" }]}>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h2 className="text-2xl font-bold">Content Unavailable</h2>
          <p className="text-muted-foreground max-w-md">
            We couldn't retrieve the contents for this topic. They might not be available yet.
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Retry Connection
          </Button>
        </div>
      </Layout>
    );
  }

  const videos = data?.data.filter(c => c.videoDetails || c.contentType?.toLowerCase().includes("video")) || [];
  const notes = data?.data.filter(c => c.notes || c.contentType?.toLowerCase().includes("notes")) || [];

  return (
    <Layout
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: batchName, href: `/batch/${batchId}` },
        { label: subjectName, href: `/batch/${batchId}/subject/${subjectId}` },
        { label: topicName }
      ]}
    >
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">{topicName}</h1>
        <p className="text-lg text-muted-foreground">Watch lectures and review class notes.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="w-full aspect-video rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-12">
          {/* VIDEOS SECTION */}
          <section>
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
              <Play className="w-6 h-6 text-primary" /> Lectures
            </h2>
            
            {videos.length === 0 ? (
              <div className="p-8 text-center bg-card rounded-xl border border-border/50 text-muted-foreground">
                No video lectures available for this topic.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {videos.map((content, index) => {
                  const videoId = content.videoDetails?.videoId;
                  if (!videoId) return null;

                  return (
                    <Link
                      key={content._id}
                      href={`/watch?batchId=${batchId}&childId=${videoId}&ContentId=${content.scheduleId || content._id}`}
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        className="group relative flex flex-col bg-card rounded-xl border border-border/50 overflow-hidden hover:border-primary/50 transition-colors cursor-pointer"
                      >
                        <div className="relative aspect-video bg-muted overflow-hidden">
                          {content.videoDetails?.imageId ? (
                            <img
                              src={content.videoDetails.imageId}
                              alt={content.videoDetails.name}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-secondary to-background flex items-center justify-center">
                              <Play className="w-12 h-12 text-muted-foreground opacity-50" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">
                              <Play className="w-6 h-6 fill-current" />
                            </div>
                          </div>
                          
                          {content.videoDetails?.duration && (
                            <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs font-medium text-white flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {content.videoDetails.duration}
                            </div>
                          )}
                        </div>
                        
                        <div className="p-4 flex flex-col flex-1">
                          <h3 className="font-bold text-sm leading-tight mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                            {content.videoDetails?.name || "Lecture Video"}
                          </h3>
                        </div>
                      </motion.div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* NOTES SECTION */}
          {notes.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
                <FileText className="w-6 h-6 text-accent" /> Study Notes
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {notes.map((content, index) => (
                  <motion.div
                    key={content._id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className="flex items-center p-4 bg-card rounded-xl border border-border/50 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded bg-accent/10 text-accent flex items-center justify-center mr-4">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate">
                        {content.notes?.[0]?.name || "Class Notes"}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">PDF Document</p>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={content.notes?.[0]?.url || "#"} target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                    </Button>
                  </motion.div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Layout>
  );
}
