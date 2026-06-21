import { useState, useEffect, useCallback } from "react";
import { Topic } from "@/hooks/usePWApi";

const KEY = (subjectId: string) => `pwx_chapter_order_${subjectId}`;

export function useChapterOrder(subjectId: string, topics: Topic[]) {
  const [orderIds, setOrderIds] = useState<string[]>([]);

  useEffect(() => {
    if (!subjectId) return;
    try {
      const saved = localStorage.getItem(KEY(subjectId));
      if (saved) setOrderIds(JSON.parse(saved));
      else setOrderIds([]);
    } catch {
      setOrderIds([]);
    }
  }, [subjectId]);

  const hasCustomOrder = orderIds.length > 0;

  const orderedTopics: Topic[] = hasCustomOrder
    ? [
        ...orderIds
          .map((id) => topics.find((t) => t._id === id))
          .filter((t): t is Topic => !!t),
        ...topics.filter((t) => !orderIds.includes(t._id)),
      ]
    : topics;

  const saveOrder = useCallback(
    (newTopics: Topic[]) => {
      const ids = newTopics.map((t) => t._id);
      setOrderIds(ids);
      try {
        localStorage.setItem(KEY(subjectId), JSON.stringify(ids));
      } catch {}
    },
    [subjectId]
  );

  const resetOrder = useCallback(() => {
    setOrderIds([]);
    try {
      localStorage.removeItem(KEY(subjectId));
    } catch {}
  }, [subjectId]);

  return { orderedTopics, saveOrder, resetOrder, hasCustomOrder };
}
