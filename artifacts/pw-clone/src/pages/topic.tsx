import { useState } from "react";
import { useTopicContents, useBatchDetails, useTopics, ContentType, getPdfUrl } from "@/hooks/usePWApi";
import { Layout } from "@/components/layout";
import { Link, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, Play, FileText, Clock, BookOpen, ExternalLink } from "lucide-react";

const TABS: { key: ContentType; label: string; icon: typeof Play }[] = [
  { key: "videos", label: "Videos", icon: Play },
  { key: "notes", label: "Notes", icon: FileText },
  { key: "DppNotes", label: "DPP Notes", icon: BookOpen },
];

function getVideoThumb(vid: any): string | null {
  if (!vid) return null;
  if (vid.image) return vid.image;
  const imageId = vid.imageId;
  if (!imageId) return null;
  if (typeof imageId === "string") return imageId;
  if (imageId.baseUrl && imageId.key) return `${imageId.baseUrl}${imageId.key}`;
  return null;
}

interface TabContentProps {
  batchId: string;
  subjectId: string;
  topicId: string;
  contentType: ContentType;
}

function TabContent({ batchId, subjectId, topicId, contentType }: TabContentProps) {
  const { data, isLoading, isError, refetch } = useTopicContents(batchId, subjectId, topicId, contentType);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="w-full aspect-video rounded-xl" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <p className="text-muted-foreground">Failed to load content.</p>
        <Button onClick={() => refetch()} variant="outline" size="sm">Retry</Button>
      </div>
    );
  }

  const items = data?.data ?? [];

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        {contentType === "videos"
          ? <Play className="w-12 h-12 mb-4 opacity-30" />
          : <FileText className="w-12 h-12 mb-4 opacity-30" />}
        <p className="text-lg font-medium">No {contentType === "DppNotes" ? "DPP Notes" : contentType} available for this topic.</p>
      </div>
    );
  }

  if (contentType === "videos") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
        {items.map((content, index) => {
          const vid = content.videoDetails;
          const thumb = getVideoThumb(vid);
          const dur = vid?.duration ? String(vid.duration) : "";
          const title = vid?.name ?? content.topic ?? "Lecture Video";

          return (
            <Link
              key={content._id}
              href={`/schedule-watch?batchId=${batchId}&subjectId=${subjectId}&scheduleId=${content._id}`}
            >
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.04 }}
                className="group flex flex-col bg-card rounded-xl border border-border/50 overflow-hidden hover:border-primary/50 transition-colors cursor-pointer"
                data-testid={`card-video-${content._id}`}
              >
                <div className="relative aspect-video bg-muted overflow-hidden">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-secondary to-background flex items-center justify-center">
                      <Play className="w-10 h-10 text-muted-foreground opacity-40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <div className="w-11 h-11 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">
                      <Play className="w-5 h-5 fill-current" />
                    </div>
                  </div>
                  {dur && (
                    <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-xs font-medium text-white flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {dur}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {title}
                  </h3>
                </div>
              </motion.div>
            </Link>
          );
        })}
      </div>
    );
  }

  // Flatten all PDFs across all content items and all their homework/attachment arrays
  const pdfRows: { key: string; title: string; pdfUrl: string | null }[] = [];
  items.forEach((content) => {
    const baseTitle = content.name ?? (contentType === "DppNotes" ? "DPP Sheet" : "Study Notes");

    if (content.homeworkIds && content.homeworkIds.length > 0) {
      content.homeworkIds.forEach((hw) => {
        const hwTitle = hw.topic ?? hw.note ?? hw.slug ?? baseTitle;
        if (hw.attachmentIds && hw.attachmentIds.length > 0) {
          hw.attachmentIds.forEach((att) => {
            pdfRows.push({ key: `${content._id}-hw-${hw._id}-att-${att._id}`, title: hwTitle, pdfUrl: getPdfUrl(att) });
          });
        } else {
          pdfRows.push({ key: `${content._id}-hw-${hw._id}`, title: hwTitle, pdfUrl: null });
        }
      });
    } else if (content.attachmentIds && content.attachmentIds.length > 0) {
      content.attachmentIds.forEach((att) => {
        pdfRows.push({ key: `${content._id}-att-${att._id}`, title: att.name ?? baseTitle, pdfUrl: getPdfUrl(att) });
      });
    } else if (content.urls && content.urls.length > 0) {
      content.urls.forEach((u, i) => {
        pdfRows.push({ key: `${content._id}-url-${i}`, title: u.name ?? baseTitle, pdfUrl: u.url });
      });
    } else {
      pdfRows.push({ key: content._id, title: baseTitle, pdfUrl: null });
    }
  });

  return (
    <div className="mt-6 space-y-3">
      {pdfRows.map(({ key, title, pdfUrl }, index) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: index * 0.04 }}
          className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border/50 hover:border-primary/30 hover:bg-card/80 transition-all"
          data-testid={`card-note-${key}`}
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            {contentType === "DppNotes"
              ? <BookOpen className="w-5 h-5" />
              : <FileText className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">PDF Document</p>
          </div>
          {pdfUrl ? (
            <Button size="sm" variant="outline" asChild>
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" />
                Open
              </a>
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Unavailable</span>
          )}
        </motion.div>
      ))}
    </div>
  );
}

export default function Topic() {
  const { batchId, subjectId, topicId } = useParams<{ batchId: string; subjectId: string; topicId: string }>();
  const [activeTab, setActiveTab] = useState<ContentType>("videos");

  const { data: batchData } = useBatchDetails(batchId!);
  const { data: topicsData } = useTopics(batchId!, subjectId!, 1);

  const batchName = batchData?.data.name || "Batch";
  const subjectName = batchData?.data.subjects.find(s => s._id === subjectId)?.subject || "Subject";
  const topicName = topicsData?.data.find(t => t._id === topicId)?.name || "Topic";

  return (
    <Layout
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: batchName, href: `/batch/${batchId}` },
        { label: subjectName, href: `/batch/${batchId}/subject/${subjectId}` },
        { label: topicName },
      ]}
    >
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">{topicName}</h1>
        <p className="text-lg text-muted-foreground">Watch lectures, review notes, and practice DPP sheets.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit mb-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            data-testid={`tab-${key}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <TabContent
            batchId={batchId!}
            subjectId={subjectId!}
            topicId={topicId!}
            contentType={activeTab}
          />
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}
