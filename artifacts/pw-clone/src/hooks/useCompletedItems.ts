import { useState, useCallback } from "react";

// Spaced repetition intervals in ms: 1d → 3d → 7d → 14d → 30d
export const REVISION_INTERVALS = [
  1  * 24 * 60 * 60 * 1000,
  3  * 24 * 60 * 60 * 1000,
  7  * 24 * 60 * 60 * 1000,
  14 * 24 * 60 * 60 * 1000,
  30 * 24 * 60 * 60 * 1000,
];
export const MAX_STAGE = REVISION_INTERVALS.length; // 5 = mastered

export interface CompletedItem {
  id: string;
  type: "video" | "dpp";
  batchId: string;
  subjectId?: string;
  topicId?: string;
  title: string;
  completedAt: number;
  // Spaced repetition
  revisionStage: number;    // 0–4 in progress, 5 = mastered
  nextRevisionAt: number;   // timestamp when next revision is due
  lastRevisedAt?: number;
}

const STORAGE_KEY = "pwx-completed-items";

/** Migrate old items that don't have revision fields */
function migrate(raw: any[]): CompletedItem[] {
  return raw.map((item) => ({
    ...item,
    revisionStage:  item.revisionStage  ?? 0,
    nextRevisionAt: item.nextRevisionAt ?? (item.completedAt + REVISION_INTERVALS[0]),
  }));
}

function load(): CompletedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migrate(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function save(items: CompletedItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
}

export type RevisionQuality = "yes" | "partial" | "no";

export function useCompletedItems() {
  const [items, setItems] = useState<CompletedItem[]>(load);

  /** Toggle completion — adds with revision stage 0, removes if already present */
  const toggle = useCallback(
    (item: Omit<CompletedItem, "completedAt" | "revisionStage" | "nextRevisionAt">) => {
      setItems((prev) => {
        const exists = prev.some((i) => i.id === item.id);
        const updated = exists
          ? prev.filter((i) => i.id !== item.id)
          : [
              ...prev,
              {
                ...item,
                completedAt:    Date.now(),
                revisionStage:  0,
                nextRevisionAt: Date.now() + REVISION_INTERVALS[0],
              },
            ];
        save(updated);
        return updated;
      });
    },
    [],
  );

  /** Record a revision attempt and advance/reset the spaced-repetition stage */
  const markRevised = useCallback(
    (id: string, quality: RevisionQuality) => {
      setItems((prev) => {
        const updated = prev.map((item) => {
          if (item.id !== id) return item;
          let stage = item.revisionStage;
          let next: number;
          if (quality === "yes") {
            stage = Math.min(stage + 1, MAX_STAGE);
            next = stage >= MAX_STAGE
              ? Date.now() + REVISION_INTERVALS[REVISION_INTERVALS.length - 1] * 2 // mastered
              : Date.now() + REVISION_INTERVALS[stage];
          } else if (quality === "partial") {
            // Same stage, half the interval (min 12h)
            const halfInterval = Math.max(REVISION_INTERVALS[stage] / 2, 12 * 60 * 60 * 1000);
            next = Date.now() + halfInterval;
          } else {
            // Forgot — drop a stage, redo sooner
            stage = Math.max(0, stage - 1);
            next = Date.now() + REVISION_INTERVALS[stage];
          }
          return { ...item, revisionStage: stage, nextRevisionAt: next, lastRevisedAt: Date.now() };
        });
        save(updated);
        return updated;
      });
    },
    [],
  );

  const isCompleted = useCallback(
    (id: string) => items.some((i) => i.id === id),
    [items],
  );

  /** Items whose nextRevisionAt is in the past (due or overdue) */
  const getDueNow = useCallback(() => {
    const now = Date.now();
    return items
      .filter((i) => i.revisionStage < MAX_STAGE && i.nextRevisionAt <= now)
      .sort((a, b) => a.nextRevisionAt - b.nextRevisionAt);
  }, [items]);

  /** Items scheduled in the future, not yet mastered */
  const getUpcoming = useCallback(() => {
    const now = Date.now();
    return items
      .filter((i) => i.revisionStage < MAX_STAGE && i.nextRevisionAt > now)
      .sort((a, b) => a.nextRevisionAt - b.nextRevisionAt);
  }, [items]);

  /** Fully mastered items */
  const getMastered = useCallback(() => {
    return items
      .filter((i) => i.revisionStage >= MAX_STAGE)
      .sort((a, b) => (b.lastRevisedAt ?? b.completedAt) - (a.lastRevisedAt ?? a.completedAt));
  }, [items]);

  /** Per-batch completion counts for the dashboard */
  const batchStats = useCallback(
    (batchId: string) => {
      const batch = items.filter((i) => i.batchId === batchId);
      return {
        videos: batch.filter((i) => i.type === "video").length,
        dpps:   batch.filter((i) => i.type === "dpp").length,
        total:  batch.length,
      };
    },
    [items],
  );

  const allBatchStats = useCallback(() => {
    const map: Record<string, { videos: number; dpps: number }> = {};
    items.forEach((item) => {
      if (!map[item.batchId]) map[item.batchId] = { videos: 0, dpps: 0 };
      if (item.type === "video") map[item.batchId].videos++;
      else map[item.batchId].dpps++;
    });
    return map;
  }, [items]);

  return {
    items,
    toggle,
    markRevised,
    isCompleted,
    getDueNow,
    getUpcoming,
    getMastered,
    batchStats,
    allBatchStats,
  };
}
