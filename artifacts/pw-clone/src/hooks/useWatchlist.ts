import { useState, useEffect, useCallback } from "react";

const STORE_KEY = "pwx-watchlist-v1";

export interface WatchlistEntry {
  videoId: string;       // content._id (schedule item ID used by vidcloud)
  batchId: string;
  subjectId: string;
  title: string;
  thumbnail?: string;
  savedAt: number;
}

type WatchlistStore = Record<string, WatchlistEntry>;

function loadStore(): WatchlistStore {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
  catch { return {}; }
}
function saveStore(store: WatchlistStore) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* noop */ }
}

export function useWatchlist() {
  const [store, setStore] = useState<WatchlistStore>(loadStore);

  useEffect(() => {
    const handler = () => setStore(loadStore());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const isSaved = useCallback(
    (videoId: string) => Boolean(store[videoId]),
    [store]
  );

  const saveVideo = useCallback((entry: WatchlistEntry) => {
    const newStore = { ...loadStore(), [entry.videoId]: entry };
    saveStore(newStore);
    setStore(newStore);
  }, []);

  const removeVideo = useCallback((videoId: string) => {
    const newStore = { ...loadStore() };
    delete newStore[videoId];
    saveStore(newStore);
    setStore(newStore);
  }, []);

  const list = Object.values(store).sort((a, b) => b.savedAt - a.savedAt);

  return { isSaved, saveVideo, removeVideo, list };
}
