import { useMemo, useState, useEffect, useRef } from "react";
import { useTopicContents, useAllTopicContents, useBatchDetails, useTopics, useAttachmentUrls, getPdfUrl, ContentType, ContentItem } from "@/hooks/usePWApi";
import { Layout } from "@/components/layout";
import { Link, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, Play, FileText, Clock, BookOpen, ExternalLink } from "lucide-react";

type TabKey = ContentType;

const TABS: { key: TabKey; label: string; icon: typeof Play }[] = [
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

interface NoteItemProps {
  batchId: string;
  subjectId: string;
  content: ContentItem;
  contentType: ContentType;
  baseIndex: number;
}

function NoteItem({ batchId, subjectId, content, contentType, baseIndex }: NoteItemProps) {
  const count = content.homeworkIds?.length || 1;
  const isDpp = contentType === "DppNotes";
  const { data, isLoading } = useAttachmentUrls(batchId, subjectId, content._id, count, isDpp);

  const baseTitle = content.name ?? content.topic ?? (contentType === "DppNotes" ? "DPP Sheet" : "Study Notes");

  const pdfs = useMemo(() => {
    if (data && data.length > 0) {
      return data.map((item, i) => {
        const hw = content.homeworkIds?.[i];
        const title = hw?.topic ?? hw?.note ?? hw?.slug ?? content.name ?? content.topic ?? baseTitle;
        return { title, url: item.url };
      });
    }
    const rows: { title: string; url: string | null }[] = [];
    if (content.homeworkIds && content.homeworkIds.length > 0) {
      content.homeworkIds.forEach(hw => {
        const hwTitle = hw.topic ?? hw.note ?? hw.slug ?? baseTitle;
        if (hw.attachmentIds && hw.attachmentIds.length > 0) {
          hw.attachmentIds.forEach(att => {
            rows.push({ title: hwTitle, url: getPdfUrl(att) || null });
          });
        } else {
          rows.push({ title: hwTitle, url: null });
        }
      });
    } else if (content.urls && content.urls.length > 0) {
      content.urls.forEach(u => {
        rows.push({ title: u.name ?? baseTitle, url: u.url });
      });
    } else {
      rows.push({ title: baseTitle, url: null });
    }
    return rows;
  }, [data, content, baseTitle]);

  if (isLoading) {
    return (
      <>
        {[1, 2].map(i => (
          <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
        ))}
      </>
    );
  }

  return (
    <>
      {pdfs.map(({ title, url }, i) => (
        <motion.div
          key={url ?? `${content._id}-${i}`}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: (baseIndex + i) * 0.04 }}
          className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border/50 hover:border-primary/30 hover:bg-card/80 transition-all"
          data-testid={`card-note-${content._id}-${i}`}
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
          {url ? (
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-1.5 cursor-pointer"
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Unavailable</span>
          )}
        </motion.div>
      ))}
    </>
  );
}

const MAX_NOTE_PAGES = 50;

interface TabContentProps {
  batchId: string;
  subjectId: string;
  topicId: string;
  contentType: ContentType;
}

/* ── Notes: sequential page-walker ── */
function NotesTabContent({ batchId, subjectId, topicId, contentType }: TabContentProps) {
  const [fetchPage, setFetchPage] = useState(1);
  const [allItems, setAllItems] = useState<ContentItem[]>([]);
  const [done, setDone] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());

  // Reset when topic / type changes
  useEffect(() => {
    setFetchPage(1);
    setAllItems([]);
    setDone(false);
    seenIds.current = new Set();
  }, [batchId, subjectId, topicId, contentType]);

  const { data, isLoading, isError, refetch } = useTopicContents(
    batchId, subjectId, topicId, contentType, fetchPage
  );

  useEffect(() => {
    if (!data) return;
    const incoming = data.data ?? [];

    // De-duplicate by _id in case the API repeats items across pages
    const fresh = incoming.filter(item => !seenIds.current.has(item._id));
    fresh.forEach(item => seenIds.current.add(item._id));

    if (fresh.length > 0) {
      setAllItems(prev => [...prev, ...fresh]);
      if (fetchPage < MAX_NOTE_PAGES) {
        setFetchPage(p => p + 1); // advance to next page
      } else {
        setDone(true);
      }
    } else {
      setDone(true); // empty page → all items fetched
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFetchingMore = !done && (isLoading || fetchPage > 1);

  if (isLoading && allItems.length === 0) {
    return (
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError && allItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <p className="text-muted-foreground">Failed to load content.</p>
        <Button onClick={() => refetch()} variant="outline" size="sm">Retry</Button>
      </div>
    );
  }

  if (done && allItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <FileText className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">No {contentType === "DppNotes" ? "DPP Notes" : "Notes"} available for this topic.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {done && allItems.length > 0 && (
        <div className="pb-1 border-b border-border/30 mb-2">
          <span className="text-xs text-muted-foreground">{allItems.length} document{allItems.length !== 1 ? "s" : ""}</span>
        </div>
      )}
      {allItems.map((content, index) => (
        <NoteItem
          key={content._id}
          batchId={batchId}
          subjectId={subjectId}
          content={content}
          contentType={contentType}
          baseIndex={index}
        />
      ))}
      {isFetchingMore && (
        <div className="flex items-center gap-3 py-3 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Loading more…
        </div>
      )}
    </div>
  );
}

/* ── Videos ── */
function VideosTabContent({ batchId, subjectId, topicId, contentType }: TabContentProps) {
  const { data, isLoading, isError, refetch } = useAllTopicContents(batchId, subjectId, topicId, contentType);

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
        <Play className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">No videos available for this topic.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
      {items.map((content, index) => {
        const vid = content.videoDetails;
        const thumb = getVideoThumb(vid);
        const dur = vid?.duration ? String(vid.duration) : "";
        const title = vid?.name ?? content.topic ?? "Lecture Video";

        const watchUrl = `https://lite.pw4free.in/player?batchid=${encodeURIComponent(batchId)}&subjectid=${encodeURIComponent(subjectId)}&lectureid=${encodeURIComponent(content._id)}&title=${encodeURIComponent(title)}`;

        return (
          <a
            key={content._id}
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
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
          </a>
        );
      })}
    </div>
  );
}

interface TabContentProps2 {
  batchId: string;
  subjectId: string;
  topicId: string;
  topicName: string;
  activeTab: TabKey;
}

function TabContent({ batchId, subjectId, topicId, topicName, activeTab }: TabContentProps2) {
  if (activeTab === "videos") {
    return <VideosTabContent batchId={batchId} subjectId={subjectId} topicId={topicId} contentType="videos" />;
  }
  return <NotesTabContent batchId={batchId} subjectId={subjectId} topicId={topicId} contentType={activeTab} />;
}

export default function Topic() {
  const { batchId, subjectId, topicId } = useParams<{ batchId: string; subjectId: string; topicId: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>("videos");

  const sp = new URLSearchParams(window.location.search);
  const fromMix = sp.get("fromMix") ?? "";
  const fromMixName = decodeURIComponent(sp.get("fromMixName") ?? "");
  const fromMixSubject = decodeURIComponent(sp.get("fromMixSubject") ?? "");

  const { data: batchData } = useBatchDetails(batchId!);
  const { data: topicsData } = useTopics(batchId!, subjectId!, 1);

  const batchName = batchData?.data.name || "Batch";
  const subjectName = fromMixSubject || batchData?.data.subjects.find(s => s._id === subjectId)?.subject || "Subject";
  const topicName = topicsData?.data.find(t => t._id === topicId)?.name || "Topic";

  const subjectHref = fromMix
    ? `/batch/${batchId}/subject/${subjectId}?fromMix=${fromMix}&fromMixName=${encodeURIComponent(fromMixName)}&fromMixSubject=${encodeURIComponent(subjectName)}`
    : `/batch/${batchId}/subject/${subjectId}`;

  const breadcrumbs = fromMix
    ? [
        { label: "Home", href: "/" },
        { label: "My Mix", href: "/my-mix" },
        { label: fromMixName || "Mix", href: `/my-mix/${fromMix}` },
        { label: subjectName, href: subjectHref },
        { label: topicName },
      ]
    : [
        { label: "Home", href: "/" },
        { label: batchName, href: `/batch/${batchId}` },
        { label: subjectName, href: `/batch/${batchId}/subject/${subjectId}` },
        { label: topicName },
      ];

  return (
    <Layout breadcrumbs={breadcrumbs}>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-2">{topicName}</h1>
        <p className="text-base sm:text-lg text-muted-foreground">Watch lectures, review notes, and practice DPP sheets.</p>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-xl w-full sm:w-fit mb-2 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            data-testid={`tab-${key}`}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-1 sm:flex-none justify-center sm:justify-start ${
              activeTab === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          <TabContent
            batchId={batchId!}
            subjectId={subjectId!}
            topicId={topicId!}
            topicName={topicName}
            activeTab={activeTab}
          />
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}
