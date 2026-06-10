import { useState, useCallback } from "react";

export interface WatchHistoryItem {
  scheduleId: string;
  batchId: string;
  subjectId: string;
  title: string;
  subjectName?: string;
  thumbnail?: string;
  watchedAt: number;
}

const HISTORY_KEY = "pw-watch-history";
const MAX_HISTORY = 20;

function loadHistory(): WatchHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useWatchHistory() {
  const [history, setHistory] = useState<WatchHistoryItem[]>(loadHistory);

  const addToHistory = useCallback((item: WatchHistoryItem) => {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.scheduleId !== item.scheduleId);
      const updated = [item, ...filtered].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const removeFromHistory = useCallback((scheduleId: string) => {
    setHistory((prev) => {
      const updated = prev.filter((h) => h.scheduleId !== scheduleId);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {}
    setHistory([]);
  }, []);

  return { history, addToHistory, removeFromHistory, clearHistory };
}
