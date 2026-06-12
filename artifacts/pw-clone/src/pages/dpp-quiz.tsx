import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useDppTest, DppQuestion, DppOption } from "@/hooks/usePWApi";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle, ChevronLeft, ChevronRight, CheckCircle2,
  XCircle, PlayCircle, Trophy, RotateCcw, BookOpen
} from "lucide-react";

const OPTION_LABELS = ["A", "B", "C", "D"];

function getQuestionImageUrl(q: DppQuestion): string {
  const img = q.imageIds?.en;
  if (!img) return "";
  return `${img.baseUrl}${img.key}`;
}

function getOptionImageUrl(opt: DppOption): string | null {
  const img = opt.imageIds?.en;
  if (!img) return null;
  return `${img.baseUrl}${img.key}`;
}

type AnswerState = "unanswered" | "revealed";

interface QuestionState {
  selected: string | null;
  state: AnswerState;
}

function ScoreCircle({ score, total }: { score: number; total: number }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const color = pct >= 60 ? "text-green-400" : pct >= 40 ? "text-yellow-400" : "text-red-400";
  return (
    <div className={`relative flex items-center justify-center w-32 h-32 rounded-full border-4 ${pct >= 60 ? "border-green-400/40" : pct >= 40 ? "border-yellow-400/40" : "border-red-400/40"}`}>
      <div className="text-center">
        <div className={`text-3xl font-extrabold ${color}`}>{pct}%</div>
        <div className="text-xs text-muted-foreground">{score}/{total}</div>
      </div>
    </div>
  );
}

export default function DppQuiz() {
  const [, navigate] = useLocation();
  const sp = new URLSearchParams(window.location.search);
  const testId = sp.get("testId") ?? "";
  const batchId = sp.get("batchId") ?? "";
  const scheduleId = sp.get("scheduleId") ?? "";
  const tag = sp.get("tag") ?? "Start";
  const cohortId = sp.get("cohortId") ?? undefined;
  const title = decodeURIComponent(sp.get("title") ?? "DPP Quiz");
  const backHref = sp.get("back") ?? "/";

  const { data, isLoading, isError, refetch } = useDppTest(testId, batchId, scheduleId, tag, cohortId);

  const questions = useMemo(() => {
    if (!data?.data?.sections) return [];
    return data.data.sections.flatMap(s => s.questions);
  }, [data]);

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, QuestionState>>({});
  const [showResult, setShowResult] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState<number | null>(null);

  const q = questions[current];
  const ans = answers[current] ?? { selected: null, state: "unanswered" };

  function selectOption(optId: string) {
    if (ans.state === "revealed") return;
    setAnswers(prev => ({ ...prev, [current]: { selected: optId, state: "unanswered" } }));
  }

  function checkAnswer() {
    if (!ans.selected) return;
    setAnswers(prev => ({ ...prev, [current]: { ...prev[current], state: "revealed" } }));
    setSolutionOpen(null);
  }

  function goNext() {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
      setSolutionOpen(null);
    } else {
      setShowResult(true);
    }
  }

  function goPrev() {
    if (current > 0) {
      setCurrent(c => c - 1);
      setSolutionOpen(null);
    }
  }

  function restart() {
    setAnswers({});
    setCurrent(0);
    setShowResult(false);
    setSolutionOpen(null);
  }

  const score = useMemo(() => {
    let marks = 0;
    questions.forEach((q, i) => {
      const a = answers[i];
      if (!a || a.state !== "revealed" || !a.selected) return;
      if (q.solutions.includes(a.selected)) {
        marks += q.positiveMarks;
      } else {
        marks -= q.negativeMarks;
      }
    });
    return Math.max(0, marks);
  }, [answers, questions]);

  const maxMarks = useMemo(() => questions.reduce((s, q) => s + q.positiveMarks, 0), [questions]);
  const answeredCount = Object.values(answers).filter(a => a.state === "revealed").length;

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Back", href: backHref },
    { label: title },
  ];

  if (isLoading) {
    return (
      <Layout breadcrumbs={breadcrumbs}>
        <div className="max-w-3xl mx-auto space-y-4 mt-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            {[0,1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || (!isLoading && questions.length === 0)) {
    return (
      <Layout breadcrumbs={breadcrumbs}>
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <p className="text-lg font-semibold">Failed to load quiz</p>
          <p className="text-sm text-muted-foreground">Could not fetch questions. Try again.</p>
          <Button onClick={() => refetch()} variant="outline">Retry</Button>
        </div>
      </Layout>
    );
  }

  if (showResult) {
    const correct = questions.filter((q, i) => {
      const a = answers[i];
      return a?.state === "revealed" && a.selected && q.solutions.includes(a.selected);
    }).length;
    const wrong = questions.filter((q, i) => {
      const a = answers[i];
      return a?.state === "revealed" && a.selected && !q.solutions.includes(a.selected);
    }).length;
    const skipped = questions.length - answeredCount;

    return (
      <Layout breadcrumbs={breadcrumbs}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto mt-4"
        >
          <div className="bg-card border border-border/50 rounded-2xl p-8 text-center space-y-6">
            <Trophy className="w-12 h-12 text-yellow-400 mx-auto" />
            <h1 className="text-2xl font-extrabold">{title}</h1>
            <p className="text-muted-foreground">Quiz Complete!</p>
            <div className="flex justify-center">
              <ScoreCircle score={score} total={maxMarks} />
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                <div className="text-2xl font-bold text-green-400">{correct}</div>
                <div className="text-muted-foreground mt-1">Correct</div>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <div className="text-2xl font-bold text-red-400">{wrong}</div>
                <div className="text-muted-foreground mt-1">Wrong</div>
              </div>
              <div className="bg-muted/50 border border-border/50 rounded-xl p-4">
                <div className="text-2xl font-bold text-muted-foreground">{skipped}</div>
                <div className="text-muted-foreground mt-1">Skipped</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Score: <span className="font-semibold text-foreground">{score} / {maxMarks}</span> marks
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button onClick={restart} variant="outline" className="gap-2">
                <RotateCcw className="w-4 h-4" /> Retry Quiz
              </Button>
              <Button onClick={() => { restart(); setShowResult(false); }} className="gap-2">
                <BookOpen className="w-4 h-4" /> Review Answers
              </Button>
            </div>
          </div>

          <div className="mt-8 space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">Question Review</h2>
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
              {questions.map((q, i) => {
                const a = answers[i];
                const isCorrect = a?.state === "revealed" && a.selected && q.solutions.includes(a.selected);
                const isWrong = a?.state === "revealed" && a.selected && !q.solutions.includes(a.selected);
                return (
                  <button
                    key={i}
                    onClick={() => { setShowResult(false); setCurrent(i); }}
                    className={`w-full aspect-square rounded-lg text-sm font-bold flex items-center justify-center transition-colors ${
                      isCorrect ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : isWrong ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : "bg-muted text-muted-foreground border border-border/50"
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      </Layout>
    );
  }

  if (!q) return null;

  const qImg = getQuestionImageUrl(q);
  const isRevealed = ans.state === "revealed";
  const isCorrect = isRevealed && !!ans.selected && q.solutions.includes(ans.selected);
  const solution = q.solutionDescription?.[0];
  const ytUrl = solution?.videos?.en?.videoUrl ?? solution?.videoDetails?.embedCode ?? null;
  const ytThumb = solution?.videoDetails?.image ?? null;

  return (
    <Layout breadcrumbs={breadcrumbs}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4 gap-4">
          <h1 className="text-lg font-bold line-clamp-1">{title}</h1>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {current + 1} / {questions.length}
          </span>
        </div>

        <div className="w-full bg-muted rounded-full h-1.5 mb-6">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${((current + 1) / questions.length) * 100}%` }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.18 }}
          >
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden mb-4">
              <div className="flex items-center gap-3 px-5 py-3 border-b border-border/50 bg-muted/30">
                <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {q.questionNumber}
                </span>
                <span className="text-xs text-muted-foreground">
                  +{q.positiveMarks} / −{q.negativeMarks}
                </span>
                {isRevealed && (
                  <span className={`ml-auto text-xs font-semibold flex items-center gap-1 ${isCorrect ? "text-green-400" : "text-red-400"}`}>
                    {isCorrect
                      ? <><CheckCircle2 className="w-3.5 h-3.5" /> Correct</>
                      : <><XCircle className="w-3.5 h-3.5" /> Wrong</>
                    }
                  </span>
                )}
              </div>
              {qImg && (
                <div className="p-4 flex justify-center bg-white">
                  <img
                    src={qImg}
                    alt={`Question ${q.questionNumber}`}
                    className="max-w-full max-h-72 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              {q.options.map((opt, oi) => {
                const label = OPTION_LABELS[oi] ?? String(oi + 1);
                const optImg = getOptionImageUrl(opt);
                const isSelected = ans.selected === opt._id;
                const isCorrectOpt = isRevealed && q.solutions.includes(opt._id);
                const isWrongSelected = isRevealed && isSelected && !isCorrectOpt;

                let cls = "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all text-left w-full ";
                if (isCorrectOpt) {
                  cls += "bg-green-500/15 border-green-500/50 text-green-300";
                } else if (isWrongSelected) {
                  cls += "bg-red-500/15 border-red-500/50 text-red-300";
                } else if (isSelected) {
                  cls += "bg-primary/15 border-primary/50 text-primary";
                } else {
                  cls += "bg-card border-border/50 hover:border-primary/30 hover:bg-primary/5 text-foreground";
                }

                return (
                  <button key={opt._id} className={cls} onClick={() => selectOption(opt._id)}>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isCorrectOpt ? "bg-green-500/30 text-green-300"
                      : isWrongSelected ? "bg-red-500/30 text-red-300"
                      : isSelected ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                    }`}>
                      {label}
                    </span>
                    {optImg ? (
                      <img src={optImg} alt={`Option ${label}`} className="h-10 object-contain bg-white rounded" />
                    ) : (
                      <span className="text-sm font-medium">{opt.texts?.en ?? label}</span>
                    )}
                    {isCorrectOpt && <CheckCircle2 className="w-4 h-4 text-green-400 ml-auto flex-shrink-0" />}
                    {isWrongSelected && <XCircle className="w-4 h-4 text-red-400 ml-auto flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            {isRevealed && ytUrl && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mb-5"
              >
                {solutionOpen === current ? (
                  <div className="rounded-xl overflow-hidden border border-border/50 bg-black aspect-video">
                    <iframe
                      src={ytUrl.includes("embed") ? ytUrl : ytUrl.replace("watch?v=", "embed/")}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Solution Video"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setSolutionOpen(current)}
                    className="flex items-center gap-3 w-full p-3.5 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:bg-primary/5 transition-all"
                  >
                    {ytThumb && (
                      <img src={ytThumb} alt="Solution" className="w-16 h-10 object-cover rounded-lg flex-shrink-0" />
                    )}
                    <PlayCircle className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium">Watch Solution</span>
                    {solution?.videoDetails?.duration && (
                      <span className="ml-auto text-xs text-muted-foreground">{solution.videoDetails.duration}</span>
                    )}
                  </button>
                )}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={goPrev}
            disabled={current === 0}
            className="gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>

          {!isRevealed ? (
            <Button
              onClick={checkAnswer}
              disabled={!ans.selected}
              className="flex-1 gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Check Answer
            </Button>
          ) : (
            <Button onClick={goNext} className="flex-1 gap-2">
              {current < questions.length - 1
                ? <><ChevronRight className="w-4 h-4" /> Next Question</>
                : <><Trophy className="w-4 h-4" /> View Results</>
              }
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={current === questions.length - 1 || !isRevealed}
            className="gap-1.5"
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap gap-1.5">
          {questions.map((q, i) => {
            const a = answers[i];
            const isAns = a?.state === "revealed";
            const isCorr = isAns && !!a.selected && q.solutions.includes(a.selected);
            return (
              <button
                key={i}
                onClick={() => { setCurrent(i); setSolutionOpen(null); }}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                  i === current ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : isCorr ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : isAns ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : a?.selected ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-muted text-muted-foreground border border-border/50"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
