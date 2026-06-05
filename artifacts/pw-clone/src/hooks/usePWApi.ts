import { useQuery } from "@tanstack/react-query";

const API_BASE = "https://pwsecureapi.onrender.com/api/pw";
const LEARNBYAKP_BASE = "https://learnbyakp.onrender.com/api/pw";
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

export function useAttachmentUrls(batchId: string, subjectId: string, contentId: string) {
  return useQuery({
    queryKey: ["attachmentUrls", batchId, subjectId, contentId],
    queryFn: async () => {
      const res = await fetch(
        `${LEARNBYAKP_BASE}/attachment-url?BatchId=${encodeURIComponent(batchId)}&SubjectId=${encodeURIComponent(subjectId)}&ContentId=${encodeURIComponent(contentId)}`
      );
      if (!res.ok) throw new Error("Failed to fetch attachment URLs");
      const json = await res.json() as { success: boolean; upstreamStatus: number; data: AttachmentUrlItem[] };
      if (!json.success || !Array.isArray(json.data)) return [];
      const seen = new Set<string>();
      return json.data.filter(item => {
        if (!item.url || seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      });
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
  contentType: ContentType
) {
  return useQuery({
    queryKey: ["topicContents", batchId, subjectId, topicId, contentType],
    queryFn: async () => {
      const url = `${API_BASE}/v2/batches/${batchId}/subject/${subjectId}/contents?page=1&contentType=${contentType}&tag=${topicId}`;
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
    queryKey: ["allTopicContents", batchId, subjectId, topicId, contentType],
    queryFn: async () => {
      const baseUrl = `${API_BASE}/v2/batches/${batchId}/subject/${subjectId}/contents`;
      const makeUrl = (page: number) =>
        `${baseUrl}?page=${page}&contentType=${contentType}&tag=${topicId}`;

      // Fetch page 1 first to learn the total count
      const firstRes = await fetch(makeUrl(1));
      if (!firstRes.ok) throw new Error(`Failed to fetch ${contentType}`);
      const firstJson = (await firstRes.json()) as {
        success: boolean;
        data: ContentItem[];
        paginate?: { limit: number; totalCount: number };
      };

      const firstData: ContentItem[] = firstJson.data ?? [];
      const paginate = firstJson.paginate;

      if (!paginate || paginate.totalCount <= firstData.length) {
        return { success: true, data: firstData };
      }

      const totalPages = Math.ceil(paginate.totalCount / paginate.limit);

      // Fetch all remaining pages in parallel
      const pageNums = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
      const rest = await Promise.all(
        pageNums.map(async (page) => {
          const r = await fetch(makeUrl(page));
          if (!r.ok) return [] as ContentItem[];
          const j = (await r.json()) as { data: ContentItem[] };
          return j.data ?? [];
        })
      );

      return {
        success: true,
        data: [...firstData, ...rest.flat()] as ContentItem[],
      };
    },
    enabled: !!batchId && !!subjectId && !!topicId,
    staleTime: MIN * 15,
    gcTime: MIN * 60,
  });
}
