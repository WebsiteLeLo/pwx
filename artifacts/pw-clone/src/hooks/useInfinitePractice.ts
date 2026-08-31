import { useMutation, useQuery } from "@tanstack/react-query";

const API_BASE = "https://proxy.streamvideo.co.in/fetch/api.penpencil.co";
const PRACTICE_BATCH_ID = "676e4dee1ec923bc192f38c9";
const EXAM_CATEGORY = "vckzned6mqjlkub8wsfh605rp";
const MINUTE = 60_000;

export const INFINITE_PRACTICE_BATCH_ID = "infinite-practice";

export const INFINITE_PRACTICE_BATCHES = [
  { id: "676e4dee1ec923bc192f38c9", name: "11th JEE", detail: "Practice for Class 11 JEE" },
  { id: "65dc6fbabb55350018d555b7", name: "12th JEE", detail: "Practice for Class 12 JEE" },
  { id: "676e5677418e84037bd6247c", name: "11th NEET", detail: "Practice for Class 11 NEET" },
  { id: "65dc6fbaf5bcd500180102cd", name: "12th NEET", detail: "Practice for Class 12 NEET" },
] as const;

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

export interface SubmitInfinitePracticeResult {
  score?: number;
  accuracy?: number;
  [key: string]: unknown;
}

export interface InfinitePracticeSolutionOption {
  text?: string | null;
  isCorrect?: boolean;
  [key: string]: unknown;
}

export interface InfinitePracticeSolution {
  text?: string | null;
  videoSolution?: { type?: number; url?: string } | null;
  otherSolution?: string | null;
  [key: string]: unknown;
}

export interface InfinitePracticeQuestionSolution {
  questionId: string;
  content?: string;
  options?: InfinitePracticeSolutionOption[];
  solutions?: InfinitePracticeSolution[];
  type?: number;
  difficulty?: number;
  chapterId?: string;
  chapterName?: string;
  subjectId?: string;
  subjectName?: string;
  timeTaken?: number;
  status?: string;
  markedSolutions?: number[];
  questionNumber?: number;
  [key: string]: unknown;
}

export interface InfinitePracticeTestSolution {
  _id?: string;
  score?: number;
  userScore?: number;
  accuracy?: number;
  totalCorrectQuestions?: number;
  totalIncorrectQuestions?: number;
  totalSkippedQuestions?: number;
  questionsResponses?: InfinitePracticeQuestionSolution[];
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

export function useInfinitePracticeSubjects(batchId: string) {
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
    enabled: Boolean(batchId?.trim()),
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
    enabled: Boolean(batchId?.trim()) && Boolean(subjectId),
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
            testMode: "EXAM",
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

export function useSubmitInfinitePractice(testId: string) {
  return useMutation({
    mutationFn: async (
      input: { questionsResponse: SubmitInfinitePracticeInput[] },
    ): Promise<SubmitInfinitePracticeResult> => {
      const response = await fetch(
        `${API_BASE}/v3/test-service/${testId}/infinitePractice/submit-test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      const payload = await readJson<{
        success: boolean;
        data?: SubmitInfinitePracticeResult;
      }>(
        response,
        "Could not submit this practice test.",
      );
      return payload.data ?? {};
    },
  });
}

export function useInfinitePracticeSolution(testId: string) {
  return useMutation({
    mutationFn: async (): Promise<InfinitePracticeTestSolution> => {
      const response = await fetch(
        `${API_BASE}/v3/test-service/${testId}/infinitePractice/test-solution`,
      );
      const payload = await readJson<{
        success: boolean;
        data?: InfinitePracticeTestSolution;
      }>(response, "Could not load the test solutions.");
      if (!payload.data) {
        throw new Error("The test solution response was empty.");
      }
      return payload.data;
    },
  });
}

export { PRACTICE_BATCH_ID };
