import { useMutation, useQuery } from "@tanstack/react-query";

const API_BASE = "https://pwsecure.gourav23032009.workers.dev/api/pw";
const PRACTICE_BATCH_ID = "676e4dee1ec923bc192f38c9";
const EXAM_CATEGORY = "vckzned6mqjlkub8wsfh605rp";
const SOLUTION_SERVICE_ID = "6a7926f671df072ea045fe87";
const MINUTE = 60_000;

export function isInfinitePracticeBatch(batchId?: string) {
  return batchId?.trim().toLowerCase() === PRACTICE_BATCH_ID;
}

export interface InfinitePracticeSubject {
  subjectId: string;
  englishName: string;
  hindiName?: string | null;
  icon?: string;
}

export interface InfinitePracticeChapter {
  chapterId: string;
  englishName: string;
  hindiName?: string | null;
  subjectId: string;
  classId: string;
  questionCount?: string | number;
  questionCountEasy?: string | number;
  questionCountMedium?: string | number;
  questionCountHard?: string | number;
}

export interface InfinitePracticeOption {
  text?: string;
  imageUrl?: string;
}

export interface InfinitePracticeQuestion {
  questionId: string;
  content?: string;
  plainQuestionText?: string;
  type: number;
  typeTitle?: string;
  difficulty: number;
  options: InfinitePracticeOption[];
  chapterId: string;
  chapterName?: string;
  subjectId: string;
  subjectName?: string;
}

export interface InfinitePracticeSession {
  testId: string;
  questions: InfinitePracticeQuestion[];
}

export interface StartInfinitePracticeInput {
  subjectId: string;
  chapters: Array<{ chapterId: string; classId: string }>;
  questionsCount: number;
  difficultyLevel: number[];
  language: "English" | "Hindi";
}

export interface SubmitInfinitePracticeInput {
  questionId: string;
  status: "ATTEMPTED" | "SKIPPED";
  chapterId: string;
  timeTaken: number;
  questionNumber: number;
  markedSolutions: number[];
  difficulty: number;
  type: number;
}

export interface SubmitInfinitePracticeResponse {
  success?: boolean;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (payload as { error?: { message?: string } } | null)?.error?.message
      || fallback;
    throw new Error(message);
  }
  return payload as T;
}

export function useInfinitePracticeSubjects(batchId = PRACTICE_BATCH_ID) {
  return useQuery({
    queryKey: ["infinitePracticeSubjects", batchId],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE}/v3/batches/${batchId}/infinitePractice/subjects`,
      );
      return readJson<{
        success: boolean;
        data: {
          examCategory: string;
          exams: unknown[];
          subjects: InfinitePracticeSubject[];
        };
      }>(response, "Could not load practice subjects.");
    },
    enabled: isInfinitePracticeBatch(batchId),
    staleTime: MINUTE * 30,
    gcTime: MINUTE * 120,
  });
}

export function useInfinitePracticeChapters(
  subjectId: string,
  batchId = PRACTICE_BATCH_ID,
) {
  return useQuery({
    queryKey: ["infinitePracticeChapters", batchId, subjectId],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE}/v3/batches/${batchId}/infinitePractice/chapters?subjectId=${encodeURIComponent(subjectId)}`,
      );
      return readJson<{
        success: boolean;
        data: InfinitePracticeChapter[];
      }>(response, "Could not load chapters for this subject.");
    },
    enabled: isInfinitePracticeBatch(batchId) && Boolean(subjectId),
    staleTime: MINUTE * 30,
    gcTime: MINUTE * 120,
  });
}

export function useStartInfinitePractice(batchId = PRACTICE_BATCH_ID) {
  return useMutation({
    mutationFn: async (input: StartInfinitePracticeInput): Promise<InfinitePracticeSession> => {
      const response = await fetch(
        `${API_BASE}/v3/test-service/${batchId}/infinitePractice/v2/start-test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exams: [],
            examCategory: EXAM_CATEGORY,
            testMode: "PRACTICE",
            questionsCount: input.questionsCount,
            chapters: input.chapters,
            subject: input.subjectId,
            difficultyLevel: input.difficultyLevel,
            isReattempt: false,
            language: input.language,
          }),
        },
      );
      const payload = await readJson<{
        success: boolean;
        data?: { _id: string; questions: InfinitePracticeQuestion[] };
      }>(response, "Could not create this practice set.");
      const session = payload.data;
      if (!session?._id || !Array.isArray(session.questions) || session.questions.length === 0) {
        throw new Error("No questions are available for this selection.");
      }
      return { testId: session._id, questions: session.questions };
    },
  });
}

export function useSubmitInfinitePractice() {
  return useMutation({
    mutationFn: async (
      input: SubmitInfinitePracticeInput,
    ): Promise<SubmitInfinitePracticeResponse> => {
      const response = await fetch(
        `${API_BASE}/v3/test-service/${SOLUTION_SERVICE_ID}/infinitePractice/submit-question-test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      return readJson<SubmitInfinitePracticeResponse>(
        response,
        "The solution service did not respond. You can retry this answer.",
      );
    },
  });
}

export { PRACTICE_BATCH_ID };