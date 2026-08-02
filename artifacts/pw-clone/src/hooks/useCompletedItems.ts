import { useState, useCallback } from "react";

export interface CompletedItem {
  id: string;
  type: "video" | "dpp";
  batchId: string;
  title: string;
  completedAt: number;
}

const STORAGE_KEY = "pwx-completed-items";

function load(): CompletedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useCompletedItems() {
  const [items, setItems] = useState<CompletedItem[]>(load);

  const toggle = useCallback(
    (item: Omit<CompletedItem, "completedAt">) => {
      setItems((prev) => {
        const exists = prev.some((i) => i.id === item.id);
        const updated = exists
          ? prev.filter((i) => i.id !== item.id)
          : [...prev, { ...item, completedAt: Date.now() }];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    },
    [],
  );

  const isCompleted = useCallback(
    (id: string) => items.some((i) => i.id === id),
    [items],
  );

  /** Returns { videos, dpps } counts for a given batchId */
  const batchStats = useCallback(
    (batchId: string) => {
      const batch = items.filter((i) => i.batchId === batchId);
      return {
        videos: batch.filter((i) => i.type === "video").length,
        dpps: batch.filter((i) => i.type === "dpp").length,
        total: batch.length,
      };
    },
    [items],
  );

  /** Returns a map of batchId → { videos, dpps } for all batches that have completions */
  const allBatchStats = useCallback(() => {
    const map: Record<string, { videos: number; dpps: number }> = {};
    items.forEach((item) => {
      if (!map[item.batchId]) map[item.batchId] = { videos: 0, dpps: 0 };
      if (item.type === "video") map[item.batchId].videos++;
      else map[item.batchId].dpps++;
    });
    return map;
  }, [items]);

  return { items, toggle, isCompleted, batchStats, allBatchStats };
}
