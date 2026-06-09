import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/apiUrl";

const API_BASE = "https://pwsecure.gourav23032009.workers.dev/api/pw";
const MIN = 1000 * 60;

export interface Batch {
  _id: string;
  name: string;
  byName: string;
  previewImage?: { baseUrl: string; key: string };
  language: string;
  startDate: string;
  endDate: string;
  feeTotal: number;
  type: string;
  slug: string;
}

export interface Subject {
  _id: string;
  subject: string;
  subjectId: string;
  description: string;
  slug: string;
  imageId?: { baseUrl: string; key: string };
  teacherIds?: {
    _id: string;
    firstName: string;
    lastName: string;
    imageId?: { baseUrl: string; key: string };
  }[];
  lectureCount: number;
  tagCount: number;
  displayOrder: number;
}

export interface BatchDetailsData {
  name: string;
  subjects: Subject[];
  [key: string]: any;
}

export interface Topic {
  _id: string;
  name: string;
  type: string;
  typeId: string;
  displayOrder: number;
  notes: number;
  exercises: number;
  videos: number;
  lectureVideos: number;
  slug: string;
}

export interface TopicsPaginate {
  limit: number;
  totalCount: number;
  videosCount: number;
}

export type ContentType = "videos" | "notes" | "DppNotes";

export interface VideoContent {
  _id: string;
  topic: string;
  contentType: string;
  scheduleId?: string;
  batchId?: string;
  videoDetails?: {
    _id?: string;
    name?: string;
    duration?: string | number;
    image?: string;
    imageId?: { baseUrl?: string; key?: string } | string;
    video_id?: string;
    vimeoId?: string;
    hls_url?: string;
    videoUrl?: string;
    description?: string;
  };
}

export interface Attachment {
  _id: string;
  baseUrl: string;
  key?: string;
  name?: string;
}

export interface HomeworkItem {
  _id: string;
  topic?: string;
  note?: string;
  slug?: string;
  status?: string;
  actions?: string[];
  attachmentIds?: Attachment[];
}

export interface NoteContent {
  _id: string;
  topic: string;
  contentType: string;
  date?: string;
  status?: string;
  homeworkIds?: HomeworkItem[];
  urls?: { url: string; name?: string }[];
  name?: string;
  attachmentIds?: Attachment[];
}

export function getPdfUrl(attachment: Attachment): string {
  let raw = "";
  if (attachment.key) {
    raw = attachment.baseUrl
      ? `${attachment.baseUrl}${attachment.key}`
      : attachment.key;
  } else {
    raw = attachment.baseUrl
      ? `${attachment.baseUrl}${attachment._id}`
      : attachment._id;
  }
  if (!raw.startsWith("http")) raw = `https://${raw}`;
  return raw;
}

export interface AttachmentUrlItem {
  topic: string;
  baseUrl: string;
  key: string;
  url: string;
}

function extractPdfUrl(data: Record<string, unknown>): string | null {
  const candidates = [
    data?.url, data?.attachmentUrl, data?.pdfUrl, data?.fileUrl, data?.link,
    (data?.data as Record<string, unknown>)?.url,
    (data?.data as Record<string, unknown>)?.attachmentUrl,
    (data?.data as Record<string, unknown>)?.pdfUrl,
    (data?.data as Record<string, unknown>)?.fileUrl,
    (data?.data as Record<string, unknown>)?.link,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("http")) return c;
  }
  return null;
}

function extractPdfName(data: Record<string, unknown>): string {
  const d = (data?.data ?? data) as Record<string, unknown>;
  return (d?.name ?? d?.topic ?? d?.title ?? "") as string;
}

export function useAttachmentUrls(batchId: string, subjectId: string, contentId: string, count = 1, isDpp = false) {
  const proxyBase = apiUrl("/api");
  return useQuery({
    queryKey: ["attachmentUrlsV2", batchId, subjectId, contentId, count, isDpp],
    queryFn: async () => {
      const indices = Array.from({ length: Math.max(count, 1) }, (_, i) => i);
      const results = await Promise.allSettled(
        indices.map(i =>
          fetch(
            `${proxyBase}/rarestudy-pdf?batchId=${encodeURIComponent(batchId)}&subjectId=${encodeURIComponent(subjectId)}&scheduleId=${encodeURIComponent(contentId)}&noteIndex=${i}&isDpp=${isDpp}`
          ).then(r => r.json() as Promise<Record<string, unknown>>)
        )
      );
      const urls: AttachmentUrlItem[] = [];
      const seen = new Set<string>();
      results.forEach(r => {
        if (r.status === "fulfilled" && r.value?.success) {
          const url = extractPdfUrl(r.value);
          if (url && !seen.has(url)) {
            seen.add(url);
            urls.push({ topic: extractPdfName(r.value), baseUrl: "", key: "", url });
          }
        }
      });
      return urls;
    },
    enabled: !!batchId && !!subjectId && !!contentId,
    staleTime: MIN * 30,
    gcTime: MIN * 120,
    retry: 1,
  });
}

export type ContentItem = VideoContent & NoteContent;

export interface ScheduleDetails {
  _id: string;
  topic: string;
  date?: string;
  startTime?: string;
  urlType?: string;
  scheduleType?: string;
  videoDetails?: {
    _id: string;
    id?: string;
    name?: string;
    duration?: string;
    image?: string;
  };
  homeworkIds?: Array<{
    _id: string;
    topic?: string;
    note?: string;
    actions?: string[];
    attachmentIds?: Attachment[];
  }>;
  dpp?: {
    _id: string;
    topic?: string;
    lectureType?: string;
    homeworkIds?: Array<{
      _id: string;
      topic?: string;
      attachmentIds?: Attachment[];
    }>;
  };
  subject?: { _id: string; subject?: string };
}

export interface VideoDetails {
  _id: string;
  name?: string;
  videoUrl?: string;
  duration?: string;
  image?: string;
  types?: string[];
  drmProtected?: boolean;
}

export function useScheduleDetails(batchId: string, subjectId: string, scheduleId: string) {
  return useQuery({
    queryKey: ["scheduleDetails", batchId, subjectId, scheduleId],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/v1/batches/${batchId}/subject/${subjectId}/schedule/${scheduleId}/schedule-details`
      );
      if (!res.ok) throw new Error("Failed to fetch schedule details");
      return res.json() as Promise<{ success: boolean; data: ScheduleDetails }>;
    },
    enabled: !!batchId && !!subjectId && !!scheduleId,
    staleTime: MIN * 30,
    gcTime: MIN * 120,
  });
}

export function useVideoDetails(videoId: string) {
  return useQuery({
    queryKey: ["videoDetails", videoId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/videos/${videoId}`);
      if (!res.ok) throw new Error("Failed to fetch video details");
      return res.json() as Promise<{ success: boolean; data: VideoDetails }>;
    },
    enabled: !!videoId,
    staleTime: MIN * 30,
    gcTime: MIN * 120,
  });
}

export function useVideoOtp(hexKey: string) {
  return useQuery({
    queryKey: ["videoOtp", hexKey],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/v1/videos/get-otp?key=${encodeURIComponent(hexKey)}&isEncoded=true`
      );
      if (!res.ok) throw new Error("Failed to fetch OTP");
      return res.json() as Promise<{ success: boolean; data: { otp: string } }>;
    },
    enabled: !!hexKey,
    retry: false,
    staleTime: MIN * 20,
    gcTime: MIN * 60,
  });
}

export function useBatches() {
  return useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const res = await fetch("https://rarestudy.github.io/rarestudy/batches.json?v=1780587098748");
      if (!res.ok) throw new Error("Failed to fetch batches");
      return res.json() as Promise<{ success: boolean; batches: Batch[] }>;
    },
    staleTime: MIN * 60,
    gcTime: MIN * 120,
  });
}

export function useBatchDetails(batchId: string) {
  return useQuery({
    queryKey: ["batchDetails", batchId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v3/batches/${batchId}/details`);
      if (!res.ok) throw new Error("Failed to fetch batch details");
      return res.json() as Promise<{ success: boolean; data: BatchDetailsData }>;
    },
    enabled: !!batchId,
    staleTime: MIN * 30,
    gcTime: MIN * 120,
  });
}

export function useTopics(batchId: string, subjectId: string, page: number) {
  return useQuery({
    queryKey: ["topics", batchId, subjectId, page],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v2/batches/${batchId}/subject/${subjectId}/topics?page=${page}`);
      if (!res.ok) throw new Error("Failed to fetch topics");
      return res.json() as Promise<{ success: boolean; data: Topic[]; paginate: TopicsPaginate }>;
    },
    enabled: !!batchId && !!subjectId,
    staleTime: MIN * 15,
    gcTime: MIN * 60,
  });
}

export function useTopicContents(
  batchId: string,
  subjectId: string,
  topicId: string,
  contentType: ContentType,
  page = 1
) {
  return useQuery({
    queryKey: ["topicContents", batchId, subjectId, topicId, contentType, page],
    queryFn: async () => {
      const url = `${API_BASE}/v2/batches/${batchId}/subject/${subjectId}/contents?page=${page}&contentType=${contentType}&tag=${topicId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${contentType}`);
      return res.json() as Promise<{ success: boolean; data: ContentItem[] }>;
    },
    enabled: !!batchId && !!subjectId && !!topicId,
    staleTime: MIN * 15,
    gcTime: MIN * 60,
  });
}

export function useAllTopicContents(
  batchId: string,
  subjectId: string,
  topicId: string,
  contentType: ContentType
) {
  return useQuery({
    queryKey: ["allTopicContentsV3", batchId, subjectId, topicId, contentType],
    queryFn: async () => {
      const baseUrl = `${API_BASE}/v2/batches/${batchId}/subject/${subjectId}/contents`;
      const makeUrl = (page: number) =>
        `${baseUrl}?page=${page}&contentType=${contentType}&tag=${topicId}`;

      const fetchPage = async (page: number): Promise<ContentItem[]> => {
        const r = await fetch(makeUrl(page));
        if (!r.ok) return [];
        const j = await r.json() as Record<string, unknown>;
        return (j.data as ContentItem[]) ?? [];
      };

      // Fetch page 1 first — inspect whatever paginate/pagination field exists
      const firstRes = await fetch(makeUrl(1));
      if (!firstRes.ok) throw new Error(`Failed to fetch ${contentType}`);
      const firstJson = await firstRes.json() as Record<string, unknown>;
      const firstData: ContentItem[] = (firstJson.data as ContentItem[]) ?? [];

      // Try to read total count from any common paginate shape
      const pag = (firstJson.paginate ?? firstJson.pagination ?? firstJson.meta ?? {}) as Record<string, unknown>;
      const rawTotal = (pag.totalCount ?? pag.total ?? pag.totalDocs ?? pag.count ?? 0) as number;
      const rawLimit = (pag.limit ?? pag.pageSize ?? pag.size ?? firstData.length) as number;

      if (rawTotal > 0 && rawLimit > 0 && rawTotal > firstData.length) {
        // We know the total — fetch all remaining pages in parallel
        const totalPages = Math.ceil(rawTotal / rawLimit);
        const pageNums = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
        const rest = await Promise.all(pageNums.map(fetchPage));
        return { success: true, data: [...firstData, ...rest.flat()] };
      }

      // No reliable paginate info — keep fetching pages sequentially until empty
      // Cap at 50 pages (500–1000 items) as a safety limit
      const allData = [...firstData];
      const MAX_PAGES = 50;

      for (let page = 2; page <= MAX_PAGES; page++) {
        const items = await fetchPage(page);
        if (items.length === 0) break;
        allData.push(...items);
        // If we got fewer items than the first page, it's probably the last page
        if (items.length < firstData.length) break;
      }

      return { success: true, data: allData };
    },
    enabled: !!batchId && !!subjectId && !!topicId,
    staleTime: MIN * 15,
    gcTime: MIN * 60,
  });
}
