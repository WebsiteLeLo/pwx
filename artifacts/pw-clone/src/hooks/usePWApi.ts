import { useQuery } from "@tanstack/react-query";

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

export interface Content {
  _id: string;
  topic: string;
  contentType: string;
  scheduleId: string;
  videoDetails?: {
    videoId: string;
    name: string;
    duration: number;
    imageId?: string;
  };
  notes?: any;
}

export function useBatches() {
  return useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const res = await fetch("https://rarestudy.github.io/rarestudy/batches.json?v=1780587098748");
      if (!res.ok) throw new Error("Failed to fetch batches");
      const json = await res.json();
      return json as { success: boolean; batches: Batch[] };
    },
  });
}

export function useBatchDetails(batchId: string) {
  return useQuery({
    queryKey: ["batchDetails", batchId],
    queryFn: async () => {
      const res = await fetch(`https://pwsecureapi.onrender.com/api/pw/v3/batches/${batchId}/details`);
      if (!res.ok) throw new Error("Failed to fetch batch details");
      const json = await res.json();
      return json as { success: boolean; data: BatchDetailsData };
    },
    enabled: !!batchId,
  });
}

export function useTopics(batchId: string, subjectId: string, page: number) {
  return useQuery({
    queryKey: ["topics", batchId, subjectId, page],
    queryFn: async () => {
      const res = await fetch(`https://pwsecureapi.onrender.com/api/pw/v2/batches/${batchId}/subject/${subjectId}/topics?page=${page}`);
      if (!res.ok) throw new Error("Failed to fetch topics");
      const json = await res.json();
      return json as { success: boolean; data: Topic[]; paginate: TopicsPaginate };
    },
    enabled: !!batchId && !!subjectId,
  });
}

export function useTopicContents(batchId: string, subjectId: string, topicId: string) {
  return useQuery({
    queryKey: ["topicContents", batchId, subjectId, topicId],
    queryFn: async () => {
      let res = await fetch(`https://pwsecureapi.onrender.com/api/pw/v2/batches/${batchId}/subject/${subjectId}/topic/${topicId}/contents?page=1`);
      
      if (!res.ok || res.status === 404) {
        // Fallback to v1 API
        res = await fetch(`https://pwsecureapi.onrender.com/api/pw/v1/batches/${batchId}/subject/${subjectId}/topic/${topicId}/contents?page=1`);
      }

      if (!res.ok) throw new Error("Failed to fetch topic contents");
      
      const json = await res.json();
      return json as { success: boolean; data: Content[] };
    },
    enabled: !!batchId && !!subjectId && !!topicId,
  });
}
