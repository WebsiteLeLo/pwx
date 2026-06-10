import { useState, useEffect, useCallback } from "react";

export interface MixSubject {
  batchId: string;
  batchName: string;
  subjectId: string;
  subjectName: string;
  teacherNames: string;
  lectureCount: number;
  imageUrl?: string;
}

export interface MixBatch {
  id: string;
  name: string;
  createdAt: number;
  subjects: MixSubject[];
}

const STORAGE_KEY = "pwx-mix-batches";

function load(): MixBatch[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as MixBatch[];
  } catch {
    return [];
  }
}

function save(data: MixBatch[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useCustomBatches() {
  const [mixes, setMixes] = useState<MixBatch[]>(load);

  const persist = useCallback((updated: MixBatch[]) => {
    save(updated);
    setMixes(updated);
  }, []);

  useEffect(() => {
    const handler = () => setMixes(load());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const createMix = useCallback((name: string): string => {
    const id = `mix-${Date.now()}`;
    persist([...mixes, { id, name, createdAt: Date.now(), subjects: [] }]);
    return id;
  }, [mixes, persist]);

  const deleteMix = useCallback((id: string) => {
    persist(mixes.filter(m => m.id !== id));
  }, [mixes, persist]);

  const renameMix = useCallback((id: string, name: string) => {
    persist(mixes.map(m => m.id === id ? { ...m, name } : m));
  }, [mixes, persist]);

  const addSubject = useCallback((mixId: string, subject: MixSubject) => {
    persist(mixes.map(m => {
      if (m.id !== mixId) return m;
      const already = m.subjects.some(
        s => s.batchId === subject.batchId && s.subjectId === subject.subjectId
      );
      if (already) return m;
      return { ...m, subjects: [...m.subjects, subject] };
    }));
  }, [mixes, persist]);

  const removeSubject = useCallback((mixId: string, batchId: string, subjectId: string) => {
    persist(mixes.map(m => {
      if (m.id !== mixId) return m;
      return { ...m, subjects: m.subjects.filter(s => !(s.batchId === batchId && s.subjectId === subjectId)) };
    }));
  }, [mixes, persist]);

  const isSubjectInMix = useCallback((mixId: string, batchId: string, subjectId: string): boolean => {
    const mix = mixes.find(m => m.id === mixId);
    return !!mix?.subjects.some(s => s.batchId === batchId && s.subjectId === subjectId);
  }, [mixes]);

  const getSubjectMixes = useCallback((batchId: string, subjectId: string): string[] => {
    return mixes.filter(m => m.subjects.some(s => s.batchId === batchId && s.subjectId === subjectId)).map(m => m.id);
  }, [mixes]);

  return { mixes, createMix, deleteMix, renameMix, addSubject, removeSubject, isSubjectInMix, getSubjectMixes };
}
