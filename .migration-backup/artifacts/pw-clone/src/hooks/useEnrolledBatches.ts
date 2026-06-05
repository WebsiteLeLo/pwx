import { useState, useCallback } from "react";
import type { Batch } from "./usePWApi";

const STORAGE_KEY = "pwx_enrolled_batches";

function loadFromStorage(): Batch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Batch[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(batches: Batch[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
  } catch {
    // ignore
  }
}

export function useEnrolledBatches() {
  const [enrolled, setEnrolled] = useState<Batch[]>(loadFromStorage);

  const enroll = useCallback((batch: Batch) => {
    setEnrolled((prev) => {
      if (prev.some((b) => b._id === batch._id)) return prev;
      const next = [batch, ...prev];
      saveToStorage(next);
      return next;
    });
  }, []);

  const unenroll = useCallback((batchId: string) => {
    setEnrolled((prev) => {
      const next = prev.filter((b) => b._id !== batchId);
      saveToStorage(next);
      return next;
    });
  }, []);

  const isEnrolled = useCallback(
    (batchId: string) => enrolled.some((b) => b._id === batchId),
    [enrolled]
  );

  return { enrolled, enroll, unenroll, isEnrolled };
}
