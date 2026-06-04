import { useQuery } from "@tanstack/react-query";

const API_BASE = "https://pwsecureapi.onrender.com/api/pw";

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
  scheduleId: string;
  batchId?: string;
  videoDetails?: {
    videoId: string;
    name: string;
    duration: number;
    imageId?: { baseUrl?: string; key?: string } | string;
    description?: string;
  };
}

export interface NoteContent {
  _id: string;
  topic: string;
  contentType: string;
  homeworkIds?: {
    _id: string;
    name: string;
    attachmentIds?: {
      baseUrl: string;
      key: string;
      name?: string;
    }[];
  }[];
  urls?: { url: string; name?: string }[];
  name?: string;
  attachmentIds?: { baseUrl: string; key: string; name?: string }[];
}

export type ContentItem = VideoContent & NoteContent;

export function useBatches() {
  return useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const res = await fetch("https://rarestudy.github.io/rarestudy/batches.json?v=1780587098748");
      if (!res.ok) throw new Error("Failed to fetch batches");
      return res.json() as Promise<{ success: boolean; batches: Batch[] }>;
    },
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
  });
}
