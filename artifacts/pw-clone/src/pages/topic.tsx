import { useMemo, useState, useEffect, useRef } from "react";
import { usePageMeta, breadcrumbSchema } from "@/hooks/usePageMeta";
import { useTopicContents, useAllTopicContents, useBatchDetails, useTopics, useAttachmentUrls, getPdfUrl, ContentType, ContentItem, AttachmentUrlItem } from "@/hooks/usePWApi";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Link, useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, Play, FileText, Clock, BookOpen, ExternalLink, Calendar, Download, CheckCircle2, Loader2 } from "lucide-react";
import { SaveOfflineButton } from "@/components/save-offline-button";
import { useCompletedItems } from "@/hooks/useCompletedItems";
import { PW_API } from "@/lib/pwApiStore";
import { apiUrl } from "@/lib/apiUrl";
import JSZip from "jszip";

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


function getPdfsFromContent(content: any, isDpp: boolean) {
  const baseTitle = content.name ?? content.topic ?? (isDpp ? "DPP Sheet" : "Study Notes");
  const candidates: { title: string; url: string | null; priority: number }[] = [];

  // Helper to extract from an array of Attachment objects
  const extractAttachments = (atts: any[], title: string, priority: number) => {
    if (!atts || atts.length === 0) return false;
    let found = false;
    atts.forEach((att: any) => {
      let url = getPdfUrl(att);
      if (url) {
        // If url doesn't end with .pdf and doesn't contain a file extension, it might be a bad _id fallback
        if (!url.includes('.pdf') && !url.includes('.doc')) {
           priority -= 50; // lower priority for suspected bad URLs
        }
        candidates.push({ title, url, priority });
        found = true;
      }
    });
    return found;
  };

  // 1. Try content.homeworkIds (Priority 30)
  let hasHwAttachments = false;
  if (content.homeworkIds && content.homeworkIds.length > 0) {
    content.homeworkIds.forEach((hw: any) => {
      const hwTitle = hw.topic ?? hw.note ?? hw.slug ?? baseTitle;
      const found = extractAttachments(hw.attachmentIds, hwTitle, 30);
      if (found) hasHwAttachments = true;
    });
  }

  // 2. Try content.attachmentIds (Top-level) (Priority 20)
  let hasTopAttachments = false;
  if (content.attachmentIds && content.attachmentIds.length > 0) {
    hasTopAttachments = extractAttachments(content.attachmentIds, baseTitle, 20);
  }

  // 3. Try content.urls (Priority 10)
  let hasUrls = false;
  if (content.urls && content.urls.length > 0) {
    content.urls.forEach((u: any) => {
      candidates.push({ title: u.name ?? baseTitle, url: u.url, priority: 10 });
      hasUrls = true;
    });
  }

  // Filter candidates to only return the highest priority ones
  // If there are any candidates with priority > 0, return those.
  let bestCandidates = candidates;
  if (candidates.length > 0) {
    const maxPriority = Math.max(...candidates.map(c => c.priority));
    // If the best we have is a bad URL (priority < 0) from homeworkIds, maybe top-level attachmentIds has a good URL!
    // So we pick the candidate(s) that have the highest priority.
    bestCandidates = candidates.filter(c => c.priority === maxPriority);
  }

  const rows = bestCandidates.map(c => ({ title: c.title, url: c.url }));

  // Fallback if nothing found
  if (rows.length === 0) {
    // If homeworkIds was present but had NO attachments at all, we used to push null.
    if (content.homeworkIds && content.homeworkIds.length > 0 && !hasHwAttachments) {
       content.homeworkIds.forEach((hw: any) => {
          const hwTitle = hw.topic ?? hw.note ?? hw.slug ?? baseTitle;
          rows.push({ title: hwTitle, url: null });
       });
    } else {
       rows.push({ title: baseTitle, url: null });
    }
  }

  return rows;
}


function OpenPdfButton({ batchId, subjectId, contentId, isDpp, index, fallbackUrl }: { batchId: string, subjectId: string, contentId: string, isDpp: boolean, index: number, fallbackUrl: string }) {
  const [loading, setLoading] = useState(false);
  
  const handleOpen = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${PW_API}/v1/batches/${batchId}/subject/${subjectId}/schedule/${contentId}/schedule-details`);
      const json = await res.json();
      const schedData = json.data;
      
      const urls: string[] = [];
      const extractAtts = (atts: any[]) => {
        if (!atts) return;
        atts.forEach(att => {
           const u = getPdfUrl(att);
           if (u && (u.includes('.pdf') || u.includes('.doc'))) urls.push(u);
        });
      };
      
      if (isDpp) {
         if (schedData.dpp?.homeworkIds) {
           schedData.dpp.homeworkIds.forEach((hw: any) => extractAtts(hw.attachmentIds));
         } else if (schedData.homeworkIds) {
           schedData.homeworkIds.forEach((hw: any) => extractAtts(hw.attachmentIds));
         }
      } else {
         if (schedData.homeworkIds) {
           schedData.homeworkIds.forEach((hw: any) => extractAtts(hw.attachmentIds));
         }
         extractAtts(schedData.attachmentIds);
      }
      if (schedData.urls) {
         schedData.urls.forEach((u: any) => { if (u.url) urls.push(u.url); });
      }
      
      const finalUrl = urls[index] || fallbackUrl;
      window.open(finalUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className="flex items-center gap-1.5 cursor-pointer touch-manipulation"
      onClick={handleOpen}
      disabled={loading}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
      Open
    </Button>
  );
}

function NoteItem({ batchId, subjectId, content, contentType, baseIndex }: NoteItemProps) {
  const { toggle, isCompleted } = useCompletedItems();
  const isDpp = contentType === "DppNotes";

  const pdfs = useMemo(() => getPdfsFromContent(content, isDpp), [content, isDpp]);

  const dppItemId = (i: number) => `${content._id}-${i}`;

  return (
    <>
      {pdfs.map(({ title, url }, i) => {
        const itemId = dppItemId(i);
        const done = contentType === "DppNotes" && isCompleted(itemId);
        return (
          <motion.div
            key={url ?? itemId}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: (baseIndex + i) * 0.04 }}
            className={`flex items-center gap-4 p-4 bg-card rounded-xl border transition-all ${
              done
                ? "border-green-500/40 bg-green-500/5"
                : "border-border/50 hover:border-primary/30 hover:bg-card/80"
            }`}
            data-testid={`card-note-${content._id}-${i}`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${done ? "bg-green-500/15 text-green-500" : "bg-primary/10 text-primary"}`}>
              {done
                ? <CheckCircle2 className="w-5 h-5" />
                : contentType === "DppNotes"
                  ? <BookOpen className="w-5 h-5" />
                  : <FileText className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm truncate ${done ? "line-through text-muted-foreground" : ""}`}>{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{done ? "Completed" : "PDF Document"}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {contentType === "DppNotes" && (
                <button
                  onClick={() =>
                    toggle({ id: itemId, type: "dpp", batchId, title })
                  }
                  title={done ? "Mark as incomplete" : "Mark as done"}
                  className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all touch-manipulation ${
                    done
                      ? "bg-green-500/15 border-green-500/40 text-green-500 hover:bg-green-500/25"
                      : "border-border/50 text-muted-foreground hover:border-green-500/50 hover:text-green-500 hover:bg-green-500/10"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
              {url ? (
                <OpenPdfButton 
                  batchId={batchId} 
                  subjectId={subjectId} 
                  contentId={content._id} 
                  isDpp={isDpp} 
                  index={i} 
                  fallbackUrl={url} 
                />
              ) : (
                <span className="text-xs text-muted-foreground">Unavailable</span>
              )}
            </div>
          </motion.div>
        );
      })}
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

function DownloadAllButton({ items, contentType, batchId, subjectId }: { items: ContentItem[], contentType: ContentType, batchId: string, subjectId: string }) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [isZipping, setIsZipping] = useState(false);

  
  useEffect(() => {
    if (sessionStorage.getItem("pwx_download_unlocked") === "true") {
      sessionStorage.removeItem("pwx_download_unlocked");
      localStorage.removeItem("pwx_download_intent");
      handleDownload(true);
    }
  }, []);

  const handleDownload = async (skipAd = false) => {
    if (downloading) return;
    setDownloading(true);
    
    if (!skipAd) {
      localStorage.setItem("pwx_download_intent", window.location.pathname);
      window.location.href = "https://arolinks.com/JlLtYn";
      return;
    }

    setIsZipping(false);
    setProgress(0);
    setTotal(0);

    const pdfs: { title: string, url: string }[] = [];
    const isDpp = contentType === "DppNotes";
    
    // Step 1: Get attachment URLs directly from content
    const zip = new JSZip();

    const extractRealUrls = (schedData: any, isDpp: boolean) => {
      const urls: string[] = [];
      const extractAtts = (atts: any[]) => {
        if (!atts) return;
        atts.forEach(att => {
           const u = getPdfUrl(att);
           if (u && (u.includes('.pdf') || u.includes('.doc'))) urls.push(u);
        });
      };
      
      if (isDpp) {
         if (schedData.dpp?.homeworkIds) {
           schedData.dpp.homeworkIds.forEach((hw: any) => extractAtts(hw.attachmentIds));
         } else if (schedData.homeworkIds) {
           schedData.homeworkIds.forEach((hw: any) => extractAtts(hw.attachmentIds));
         }
      } else {
         if (schedData.homeworkIds) {
           schedData.homeworkIds.forEach((hw: any) => extractAtts(hw.attachmentIds));
         }
         extractAtts(schedData.attachmentIds);
      }
      if (schedData.urls) {
         schedData.urls.forEach((u: any) => { if (u.url) urls.push(u.url); });
      }
      return urls;
    };

    for (const content of items) {
      const extractedPdfs = getPdfsFromContent(content, isDpp);
      
      // Try to get real URLs from schedule-details
      let realUrls: string[] = [];
      try {
        const res = await fetch(`${PW_API}/v1/batches/${batchId}/subject/${subjectId}/schedule/${content._id}/schedule-details`);
        if (res.ok) {
          const json = await res.json() as { success: boolean; data: any };
          realUrls = extractRealUrls(json.data, isDpp);
        }
      } catch (err) {
        console.error("Failed to fetch schedule-details", err);
      }

      for (let i = 0; i < extractedPdfs.length; i++) {
        const pdf = extractedPdfs[i];
        const finalUrl = realUrls[i] || pdf.url;
        if (finalUrl) {
          pdfs.push({ title: pdf.title, url: finalUrl });
        }
      }
    }

    if (pdfs.length === 0) {
      setDownloading(false);
      return;
    }

    setTotal(pdfs.length);

    for (let i = 0; i < pdfs.length; i++) {
      const { title, url } = pdfs[i];
      try {
        const proxiedUrl = apiUrl(`/pdf?url=${encodeURIComponent(url)}`);
        const res = await fetch(proxiedUrl);
        if (!res.ok) throw new Error("Fetch failed");
        const blob = await res.blob();
        
        const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '-').trim() || `Document_${i+1}`;
        zip.file(`${safeTitle}.pdf`, blob);
      } catch (err) {
        console.error("Failed to download", title, err);
      }
      setProgress(i + 1);
    }

    if (Object.keys(zip.files).length > 0) {
      setIsZipping(true);
      try {
        const content = await zip.generateAsync({ type: "blob" });
        const objUrl = URL.createObjectURL(content);
        const a = document.createElement("a");
        a.href = objUrl;
        const zipName = (contentType === "DppNotes" ? "DPPs" : "Notes") + "_PWX.zip";
        a.download = zipName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
      } catch (e) {
        console.error("Failed to generate zip", e);
      }
    }

    setIsZipping(false);
    setDownloading(false);
    setProgress(0);
    setTotal(0);
  };

  if (items.length === 0) return null;

  return (
    <Button 
      size="sm" 
      variant="outline" 
      className="text-xs h-8 gap-1.5 bg-background/50 hover:bg-background shadow-sm"
      onClick={() => handleDownload(false)}
      disabled={downloading}
    >
      {downloading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {isZipping ? "Zipping..." : `${progress} / ${total}`}
        </>
      ) : (
        <>
          <Download className="w-3.5 h-3.5" />
          Download All
        </>
      )}
    </Button>
  );
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
        <div className="pb-2 border-b border-border/30 mb-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{allItems.length} document{allItems.length !== 1 ? "s" : ""}</span>
          <DownloadAllButton items={allItems} contentType={contentType} batchId={batchId} subjectId={subjectId} />
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
  const { toggle, isCompleted } = useCompletedItems();

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
        const dateStr = content.date
          ? new Date(content.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : null;

        const watchUrl = `/watch?batchId=${encodeURIComponent(batchId)}&subjectId=${encodeURIComponent(subjectId)}&childId=${encodeURIComponent(content._id)}`;
        const done = isCompleted(content._id);
        
        return (
          <Link
            key={content._id}
            href={watchUrl}
            className="block" // Layout maintain rakhne ke liye
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
              className={`group flex flex-col bg-card rounded-xl border overflow-hidden transition-colors cursor-pointer ${
                done ? "border-green-500/40" : "border-border/50 hover:border-primary/50"
              }`}
              data-testid={`card-video-${content._id}`}
            >
              <div className="relative aspect-video bg-muted overflow-hidden">
                {thumb ? (
                  <img
                    src={thumb}
                    alt={title}
                    loading="lazy"
                    className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${done ? "opacity-60" : ""}`}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-secondary to-background flex items-center justify-center">
                    <Play className="w-10 h-10 text-muted-foreground opacity-40" />
                  </div>
                )}
                
                {/* ... Baaki ka existing video card code same rahega ... */}
                
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <div className="w-11 h-11 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">
                    <Play className="w-5 h-5 fill-current" />
                  </div>
                </div>
                {done && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-12 h-12 rounded-full bg-green-500/90 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-white fill-white" />
                    </div>
                  </div>
                )}
                {dur && (
                  <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-xs font-medium text-white flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {dur}
                  </div>
                )}
                <SaveOfflineButton
                  videoId={vid?._id || vid?.video_id || content._id}
                  batchId={batchId}
                  subjectId={subjectId}
                  title={title}
                  thumbnail={thumb ?? undefined}
                />
              </div>
              <div className="p-4 flex flex-col gap-1.5">
                <h3 className={`font-semibold text-sm leading-snug line-clamp-2 transition-colors ${done ? "text-muted-foreground line-through" : "group-hover:text-primary"}`}>
                  {title}
                </h3>
                {dateStr && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    {dateStr}
                  </div>
                )}
                <div className="mt-1 flex gap-1.5">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle({ id: content._id, type: "video", batchId, subjectId, topicId, title });
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      done
                        ? "bg-green-500/15 text-green-500 border-green-500/30 hover:bg-green-500/25"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground border-border/40 hover:border-green-500/40 hover:text-green-600"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {done ? "Completed" : "Mark Done"}
                  </button>
                  {vid?._id && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(`https://t.me/AS_MultiverseRoBot?start=${batchId}_${vid._id}`, "_blank", "noopener,noreferrer");
                      }}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </Link>
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

  usePageMeta({
    title: `${topicName} — ${subjectName} | Free PW Videos & Notes`,
    description: `Watch ${topicName} free video lectures in ${subjectName} (${batchName}) on PWX. Download notes and DPP sheets for IIT JEE & NEET preparation.`,
    canonical: `/batch/${batchId}/subject/${subjectId}/topic/${topicId}`,
    schema: breadcrumbSchema([
      { label: "Home", href: "/" },
      { label: batchName, href: `/batch/${batchId}` },
      { label: subjectName, href: `/batch/${batchId}/subject/${subjectId}` },
      { label: topicName },
    ]),
  });

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
