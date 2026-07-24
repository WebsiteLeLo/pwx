// ── Aria Action Event Bus ─────────────────────────────────────────────────────
// Aria dispatches actions here; pages/components listen and execute them.

export interface DppResult {
  batchId: string;
  batchName: string;
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  dppCount: number;
}

export type AriaAction =
  | { type: "search_batches"; query: string }
  | { type: "navigate_to_batch"; batchId: string; batchName: string }
  | { type: "open_subject"; batchId: string; subjectId: string; batchName: string; subjectName: string }
  | { type: "navigate_home" }
  | { type: "play_video"; batchId: string; subjectId: string; contentId: string };

const bus = new EventTarget();

export function emitAriaAction(action: AriaAction) {
  bus.dispatchEvent(new CustomEvent("aria-action", { detail: action }));
}

export function onAriaAction(handler: (action: AriaAction) => void): () => void {
  const fn = (e: Event) => handler((e as CustomEvent<AriaAction>).detail);
  bus.addEventListener("aria-action", fn);
  return () => bus.removeEventListener("aria-action", fn);
}
