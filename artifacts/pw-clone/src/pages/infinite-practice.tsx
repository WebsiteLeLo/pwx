import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  CircleHelp,
  FileQuestion,
  FlaskConical,
  Loader2,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useBatchDetails } from "@/hooks/usePWApi";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  useInfinitePracticeChapters,
  useInfinitePracticeSubjects,
  useStartInfinitePractice,
  useSubmitInfinitePractice,
  isInfinitePracticeBatch,
  type InfinitePracticeChapter,
  type InfinitePracticeQuestion,
  type InfinitePracticeSubject,
} from "@/hooks/useInfinitePractice";

type RoomState = "selection" | "question" | "complete";

const QUESTION_COUNTS = [5, 10, 15, 20];
const DIFFICULTIES = [
  { value: 1, label: "Easy", detail: "Build confidence" },
  { value: 2, label: "Medium", detail: "Stay exam-ready" },
  { value: 3, label: "Hard", detail: "Stretch your ceiling" },
];

function stripUnsafeHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "");
}

function HtmlContent({
  html,
  className = "",
  testId,
}: {
  html?: string;
  className?: string;
  testId?: string;
}) {
  if (!html) return null;
  return (
    <div
      className={`practice-html [&_img]:mx-auto [&_img]:max-w-full [&_img]:object-contain [&_p]:mb-2 [&_table]:max-w-full [&_table]:overflow-auto ${className}`}
      data-testid={testId}
      dangerouslySetInnerHTML={{ __html: stripUnsafeHtml(html) }}
    />
  );
}

function subjectIcon(subject: InfinitePracticeSubject) {
  const name = subject.englishName.toLowerCase();
  if (name.includes("physics")) return <Zap className="h-5 w-5" />;
  if (name.includes("chem")) return <FlaskConical className="h-5 w-5" />;
  return <Target className="h-5 w-5" />;
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-rose-200 bg-white px-6 text-center"
      data-testid="state-practice-error"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <CircleHelp className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold text-slate-900">Could not load Infinite Practice</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{message}</p>
      <button
        data-testid="button-practice-retry"
        onClick={onRetry}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
      >
        <RotateCcw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}

function ChapterRow({
  chapter,
  selected,
  onClick,
}: {
  chapter: InfinitePracticeChapter;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      data-testid={`button-chapter-${chapter.chapterId}`}
      aria-pressed={selected}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all ${
        selected
          ? "border-indigo-500 bg-indigo-50 text-indigo-950"
          : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300"
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
          selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 text-transparent"
        }`}
      >
        <Check className="h-3 w-3" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{chapter.englishName}</span>
        <span className="mt-0.5 block text-[11px] text-slate-500">
          {Number(chapter.questionCount || 0).toLocaleString("en-IN")} questions
        </span>
      </span>
    </button>
  );
}

function SelectionPanel({
  batchId,
  batchName,
  onStarted,
}: {
  batchId: string;
  batchName: string;
  onStarted: (session: { testId: string; questions: InfinitePracticeQuestion[] }) => void;
}) {
  const subjectsQuery = useInfinitePracticeSubjects(batchId);
  const startPractice = useStartInfinitePractice(batchId);
  const subjects = subjectsQuery.data?.data.subjects ?? [];
  const [subjectId, setSubjectId] = useState("");
  const chaptersQuery = useInfinitePracticeChapters(subjectId, batchId);
  const chapters = chaptersQuery.data?.data ?? [];
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState<number[]>([1, 2, 3]);

  useEffect(() => {
    setChapterIds([]);
  }, [subjectId]);

  const selectedChapters = useMemo(
    () => chapters.filter((chapter) => chapterIds.includes(chapter.chapterId)),
    [chapters, chapterIds],
  );

  const toggleDifficulty = (value: number) => {
    setDifficulty((current) => {
      if (current.includes(value)) {
        return current.length === 1 ? current : current.filter((item) => item !== value);
      }
      return [...current, value].sort();
    });
  };

  const toggleChapter = (chapterId: string) => {
    setChapterIds((current) =>
      current.includes(chapterId)
        ? current.filter((item) => item !== chapterId)
        : [...current, chapterId],
    );
  };

  const start = () => {
    const selectedSubject = subjects.find((subject) => subject.subjectId === subjectId);
    if (!selectedSubject || selectedChapters.length === 0) return;
    startPractice.mutate(
      {
        subjectId,
        chapters: selectedChapters.map((chapter) => ({
          chapterId: chapter.chapterId,
          classId: chapter.classId,
        })),
        questionsCount: questionCount,
        difficultyLevel: difficulty,
        language: "English",
      },
      { onSuccess: onStarted },
    );
  };

  if (subjectsQuery.isLoading) {
    return (
      <div className="space-y-5" data-testid="state-practice-loading">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-48 rounded-3xl" />
      </div>
    );
  }

  if (subjectsQuery.isError) {
    return <ErrorState message={subjectsQuery.error.message} onRetry={() => subjectsQuery.refetch()} />;
  }

  if (subjects.length === 0) {
    return (
      <div
        className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 text-center"
        data-testid="state-practice-empty"
      >
        <BookOpen className="mb-4 h-10 w-10 text-slate-300" />
        <h2 className="text-lg font-bold text-slate-900">No practice subjects are available</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
          This practice catalog does not have published subjects for {batchName} yet.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
      data-testid="panel-practice-selection"
    >
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
              Step 01 / Choose subject
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">What do you want to practise?</h2>
            <p className="mt-2 text-sm text-slate-500">Choose a subject, then select one or more chapters.</p>
          </div>
          {subjectId && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Subject selected
            </span>
          )}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {subjects.map((subject) => (
            <button
              key={subject.subjectId}
              data-testid={`button-subject-${subject.subjectId}`}
              aria-pressed={subjectId === subject.subjectId}
              onClick={() => setSubjectId(subject.subjectId)}
              className={`flex min-h-[88px] items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
                subjectId === subject.subjectId
                  ? "border-indigo-500 bg-indigo-50 text-indigo-950 shadow-sm"
                  : "border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-indigo-300"
              }`}
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${subjectId === subject.subjectId ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                {subject.icon ? (
                  <img src={subject.icon} alt="" className="h-7 w-7 object-contain" />
                ) : (
                  subjectIcon(subject)
                )}
              </span>
              <span className="min-w-0">
                <span className="block font-bold">{subject.englishName}</span>
                {subject.hindiName && <span className="mt-0.5 block text-xs text-slate-500">{subject.hindiName}</span>}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_290px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
                Step 02 / Pick chapters
              </p>
              <h2 className="text-xl font-bold text-slate-900">Practice exactly what you need</h2>
            </div>
            {chapters.length > 0 && (
              <button
                data-testid="button-select-all-chapters"
                onClick={() => setChapterIds(chapterIds.length === chapters.length ? [] : chapters.map((chapter) => chapter.chapterId))}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
              >
                {chapterIds.length === chapters.length ? "Clear all" : "Select all"}
              </button>
            )}
          </div>
          <div className="mt-5">
            {!subjectId ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                Select a subject to see its chapters.
              </div>
            ) : chaptersQuery.isLoading ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-16 rounded-xl" />)}
              </div>
            ) : chaptersQuery.isError ? (
              <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{chaptersQuery.error.message}</p>
            ) : chapters.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No chapters are available for this subject.</p>
            ) : (
              <div className="grid max-h-[430px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {chapters.map((chapter) => (
                  <ChapterRow
                    key={chapter.chapterId}
                    chapter={chapter}
                    selected={chapterIds.includes(chapter.chapterId)}
                    onClick={() => toggleChapter(chapter.chapterId)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="flex flex-col rounded-3xl border border-indigo-100 bg-indigo-50/70 p-5 sm:p-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Sparkles className="h-5 w-5" />
          </span>
          <h3 className="mt-4 text-lg font-bold text-indigo-950">Build your own question set</h3>
          <p className="mt-2 text-sm leading-6 text-indigo-900/70">
            Select the chapters you want, choose a difficulty mix, and start practising without opening a full mock test.
          </p>
          <div className="mt-6 space-y-5 border-t border-indigo-200/70 pt-5">
            <fieldset>
              <legend className="mb-3 text-sm font-bold text-indigo-950">Difficulty</legend>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((item) => (
                  <button
                    key={item.value}
                    data-testid={`button-difficulty-${item.value}`}
                    aria-pressed={difficulty.includes(item.value)}
                    title={item.detail}
                    onClick={() => toggleDifficulty(item.value)}
                    className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                      difficulty.includes(item.value)
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-indigo-200 bg-white text-indigo-700"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-3 text-sm font-bold text-indigo-950">Questions</legend>
              <div className="flex flex-wrap gap-2">
                {QUESTION_COUNTS.map((count) => (
                  <button
                    key={count}
                    data-testid={`button-question-count-${count}`}
                    aria-pressed={questionCount === count}
                    onClick={() => setQuestionCount(count)}
                    className={`h-9 min-w-10 rounded-xl border px-2 text-xs font-bold ${
                      questionCount === count
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-indigo-200 bg-white text-indigo-700"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </fieldset>
            <button
              data-testid="button-start-practice"
              disabled={!subjectId || chapterIds.length === 0 || startPractice.isPending}
              onClick={start}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {startPractice.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Building your set</>
              ) : (
                <>Start practising <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
            {startPractice.isError && (
              <p className="text-xs font-medium leading-5 text-rose-700" data-testid="status-practice-start-error">
                {startPractice.error.message}
              </p>
            )}
          </div>
        </aside>
      </section>
    </motion.div>
  );
}

function QuestionRoom({
  batchId,
  session,
  onComplete,
}: {
  batchId: string;
  session: { testId: string; questions: InfinitePracticeQuestion[] };
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [solution, setSolution] = useState<Record<string, unknown> | null>(null);
  const [submitError, setSubmitError] = useState("");
  const submitAnswer = useSubmitInfinitePractice();
  const startedAt = useRef(Date.now());
  const question = session.questions[index];
  const progress = ((index + (submitted ? 1 : 0)) / session.questions.length) * 100;

  useEffect(() => {
    startedAt.current = Date.now();
    setSelected(null);
    setSubmitted(false);
    setSolution(null);
    setSubmitError("");
  }, [index]);

  const sendAnswer = () => {
    if (selected === null || submitAnswer.isPending) return;
    setSubmitError("");
    submitAnswer.mutate(
      {
        questionId: question.questionId,
        status: "ATTEMPTED",
        chapterId: question.chapterId,
        timeTaken: Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)),
        questionNumber: index + 1,
        markedSolutions: [selected + 1],
        difficulty: question.difficulty,
        type: question.type,
      },
      {
        onSuccess: (response) => {
          setSolution(response.data ?? response);
          setSubmitted(true);
        },
        onError: (error) => setSubmitError(error.message),
      },
    );
  };

  const next = () => {
    if (index === session.questions.length - 1) onComplete();
    else setIndex((value) => value + 1);
  };

  if (!question) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-4xl"
      data-testid="panel-practice-question"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            data-testid="link-leave-practice"
            href={`/batch/${batchId}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">Infinite Practice</p>
            <p className="text-sm font-semibold text-slate-700">
              Question {index + 1} <span className="font-normal text-slate-400">of {session.questions.length}</span>
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600">
          <Target className="h-3.5 w-3.5 text-indigo-600" /> {question.subjectName || "JEE 2026"}
        </span>
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <motion.div animate={{ width: `${progress}%` }} className="h-full rounded-full bg-indigo-600" />
      </div>

      <AnimatePresence mode="wait">
        <motion.article
          key={question.questionId}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="practice-question-canvas rounded-3xl border border-slate-200 p-5 shadow-sm sm:p-8"
        >
          <div className="mb-6 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <span className="truncate text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              {question.chapterName || "Practice question"}
            </span>
            <span className="shrink-0 text-xs text-slate-400">{question.typeTitle || "Question"}</span>
          </div>

          <HtmlContent
            html={question.content || question.plainQuestionText}
            className="mb-7 text-[17px] leading-8 text-slate-900 [&_img]:my-4 [&_img]:max-h-[420px]"
            testId="text-practice-question"
          />

          <div className="space-y-3" role="radiogroup" aria-label={`Answers for question ${index + 1}`}>
            {question.options.map((option, optionIndex) => {
              const isSelected = selected === optionIndex;
              return (
                <button
                  key={`${question.questionId}-${optionIndex}`}
                  data-testid={`button-option-${optionIndex + 1}`}
                  role="radio"
                  aria-checked={isSelected}
                  disabled={submitted}
                  onClick={() => setSelected(optionIndex)}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all disabled:cursor-default ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    {String.fromCharCode(65 + optionIndex)}
                  </span>
                  <HtmlContent html={option.text} className="min-w-0 flex-1 pt-0.5 text-sm leading-6 text-slate-800 [&_p]:mb-0" />
                </button>
              );
            })}
          </div>

          {submitted && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4"
              data-testid="panel-practice-solution"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Lightbulb className="h-4 w-4 text-amber-600" /> Solution
              </div>
              {solution && (
                <div className="mt-3 text-sm leading-6 text-slate-700">
                  <HtmlContent
                    html={
                      (solution.solution as string)
                      || (solution.solutionText as string)
                      || (solution.content as string)
                      || (solution.explanation as string)
                    }
                  />
                  {typeof solution.solutionImageUrl === "string" && (
                    <img src={solution.solutionImageUrl} alt="Worked solution" className="mt-3 max-h-[360px] max-w-full object-contain" />
                  )}
                </div>
              )}
              {!solution && <p className="mt-2 text-sm text-slate-600">Your answer was submitted successfully.</p>}
            </motion.div>
          )}

          {submitError && (
            <div className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700" data-testid="status-practice-submit-error">
              {submitError}
            </div>
          )}

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">
              {submitted ? "Answer submitted" : "Select an option to see the solution"}
            </p>
            {!submitted ? (
              <button
                data-testid="button-submit-answer"
                disabled={selected === null || submitAnswer.isPending}
                onClick={sendAnswer}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                {submitAnswer.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking...</> : <>Check answer <ArrowRight className="h-4 w-4" /></>}
              </button>
            ) : (
              <button
                data-testid="button-next-question"
                onClick={next}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-800"
              >
                {index === session.questions.length - 1 ? "Finish practice" : "Next question"} <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </motion.article>
      </AnimatePresence>
    </motion.div>
  );
}

function Completion({ onRestart }: { onRestart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-7 text-center sm:p-10"
      data-testid="state-practice-complete"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <Trophy className="h-8 w-8" />
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Set complete</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Practice set finished</h2>
      <p className="mt-3 text-sm leading-6 text-slate-500">Keep the momentum going with another focused set.</p>
      <button
        data-testid="button-practice-again"
        onClick={onRestart}
        className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-700"
      >
        <RotateCcw className="h-4 w-4" /> Practise another set
      </button>
    </motion.div>
  );
}

export default function InfinitePractice() {
  const { batchId = "" } = useParams<{ batchId: string }>();
  const { data: batchData } = useBatchDetails(batchId);
  const [roomState, setRoomState] = useState<RoomState>("selection");
  const [session, setSession] = useState<{ testId: string; questions: InfinitePracticeQuestion[] } | null>(null);
  const batchName = batchData?.data?.name || "Arjuna JEE 2026";

  usePageMeta({
    title: `Infinite Practice | ${batchName}`,
    description: `Choose a subject and chapter to practise JEE questions from the ${batchName} batch.`,
    canonical: `/batch/${batchId}/infinite-practice`,
  });

  if (!isInfinitePracticeBatch(batchId)) {
    return (
      <Layout breadcrumbs={[{ label: "Batch", href: `/batch/${batchId}` }, { label: "Infinite Practice" }]}>
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white px-6 text-center">
          <CircleHelp className="mb-4 h-10 w-10 text-slate-300" />
          <h1 className="text-xl font-bold text-slate-900">Practice is not available in this batch</h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            Infinite Practice is currently available for supported Arjuna JEE batches only.
          </p>
          <Link
            data-testid="link-practice-back-unavailable"
            href={`/batch/${batchId}`}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back to batch
          </Link>
        </div>
      </Layout>
    );
  }

  const startQuestionRoom = (nextSession: { testId: string; questions: InfinitePracticeQuestion[] }) => {
    setSession(nextSession);
    setRoomState("question");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Layout breadcrumbs={[{ label: batchName, href: `/batch/${batchId}` }, { label: "Infinite Practice" }]}>
      <div className="min-h-[calc(100dvh-10rem)] bg-white pb-8" data-testid="page-infinite-practice">
        {roomState === "selection" && (
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
                  <FileQuestion className="h-3.5 w-3.5" /> Your practice room
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  Infinite Practice<span className="text-indigo-600">.</span>
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
                  Pick a subject, chapter, difficulty, and question count. Practise at your own pace.
                </p>
              </div>
              <Link
                data-testid="link-practice-back"
                href={`/batch/${batchId}`}
                className="inline-flex h-10 items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 sm:self-auto"
              >
                <ArrowLeft className="h-4 w-4" /> Batch overview
              </Link>
            </div>
            <SelectionPanel batchId={batchId} batchName={batchName} onStarted={startQuestionRoom} />
          </div>
        )}
        {roomState === "question" && session && (
          <QuestionRoom
            batchId={batchId}
            session={session}
            onComplete={() => {
              setRoomState("complete");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}
        {roomState === "complete" && (
          <Completion
            onRestart={() => {
              setSession(null);
              setRoomState("selection");
            }}
          />
        )}
      </div>
    </Layout>
  );
}