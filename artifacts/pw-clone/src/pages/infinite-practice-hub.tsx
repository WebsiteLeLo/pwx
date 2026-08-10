import { ArrowRight, BookOpen, BrainCircuit, ChevronLeft, FlaskConical, Target } from "lucide-react";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import { INFINITE_PRACTICE_BATCHES } from "@/hooks/useInfinitePractice";

export default function InfinitePracticeHub() {
  usePageMeta({
    title: "Infinite Practice | PWX",
    description: "Choose your class and exam to start Infinite Practice on PWX.",
    canonical: "/batch/infinite-practice",
  });

  return (
    <div className="min-h-screen w-full bg-white text-slate-900">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/pw"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" /> All batches
        </Link>

        <section className="mt-8 overflow-hidden rounded-[2rem] border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-6 sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-sm">
                <BrainCircuit className="h-3.5 w-3.5" /> Focused question practice
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
                Infinite Practice<span className="text-indigo-600">.</span>
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                Apni class aur exam choose karein, phir subject aur chapters ke hisaab se unlimited practice set banayein.
              </p>
            </div>
            <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 sm:flex">
              <Target className="h-10 w-10" />
            </div>
          </div>
        </section>

        <div className="mt-8">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Choose your batch</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">What are you preparing for?</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {INFINITE_PRACTICE_BATCHES.map((batch, index) => {
              const isJee = batch.name.includes("JEE");
              return (
                <Link
                  key={batch.id}
                  href={`/batch/${batch.id}/infinite-practice`}
                  data-testid={`link-practice-batch-${batch.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100"
                >
                  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${isJee ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"}`}>
                    {isJee ? <BookOpen className="h-7 w-7" /> : <FlaskConical className="h-7 w-7" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold text-slate-900">{batch.name}</span>
                    <span className="mt-1 block text-sm text-slate-500">{batch.detail}</span>
                  </span>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                    <ArrowRight className="h-5 w-5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}