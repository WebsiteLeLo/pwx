import { useState, useCallback } from "react";

export interface PinnedChapter {
  topicId: string;
  topicName: string;
  batchId: string;
  batchName: string;
  subjectId: string;
  subjectName: string;
  href: string;
  pinnedAt: number;
  videoCount: number;
  noteCount: number;
}

const STORAGE_KEY = "pwx_pinned_chapters";

function load(): PinnedChapter[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function save(items: PinnedChapter[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* noop */ }
}

export function usePinnedChapters() {
  const [pinned, setPinned] = useState<PinnedChapter[]>(load);

  const isPinned = useCallback(
    (topicId: string) => pinned.some((p) => p.topicId === topicId),
    [pinned]
  );

  const pin = useCallback((chapter: Omit<PinnedChapter, "pinnedAt">) => {
    setPinned((prev) => {
      if (prev.some((p) => p.topicId === chapter.topicId)) return prev;
      const next = [{ ...chapter, pinnedAt: Date.now() }, ...prev];
      save(next);
      return next;
    });
  }, []);

  const unpin = useCallback((topicId: string) => {
    setPinned((prev) => {
      const next = prev.filter((p) => p.topicId !== topicId);
      save(next);
      return next;
    });
  }, []);

  const toggle = useCallback(
    (chapter: Omit<PinnedChapter, "pinnedAt">) => {
      if (isPinned(chapter.topicId)) {
        unpin(chapter.topicId);
      } else {
        pin(chapter);
      }
    },
    [isPinned, pin, unpin]
  );

  return { pinned, isPinned, pin, unpin, toggle };
}
