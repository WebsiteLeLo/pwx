import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { useQueries } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, Clock, Calendar, BookOpen } from "lucide-react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useBatchDetails, ContentItem } from "@/hooks/usePWApi";

const API_BASE = "https://pwsecure.gourav23032009.workers.dev/api/pw";
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function fmtDate(key: string) {
  const [y,m,d] = key.split("-").map(Number);
  return new Date(y, m-1, d).toLocaleDateString("en-IN", {
    weekday:"long", day:"numeric", month:"long", year:"numeric",
  });
}

function getThumb(vid: any): string | null {
  if (!vid) return null;
  if (vid.image) return vid.image;
  const id = vid.imageId;
  if (!id) return null;
  if (typeof id === "string") return id;
  if (id.baseUrl && id.key) return `${id.baseUrl}${id.key}`;
  return null;
}

function fmtDur(raw?: string|number) {
  if (!raw) return null;
  const s = String(raw);
  if (s.includes(":")) return s;
  const n = Number(s);
  if (isNaN(n)) return s;
  const h=Math.floor(n/3600), m=Math.floor((n%3600)/60), sec=n%60;
  return h>0
    ? `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`
    : `${m}:${String(sec).padStart(2,"0")}`;
}

async function fetchAllSubjectVideos(batchId: string, subjectId: string): Promise<ContentItem[]> {
  const base = `${API_BASE}/v2/batches/${batchId}/subject/${subjectId}/contents`;
  const mk = (p: number) => `${base}?page=${p}&contentType=videos`;
  const fetchPage = async (p: number): Promise<ContentItem[]> => {
    const r = await fetch(mk(p));
    if (!r.ok) return [];
    const j = await r.json() as any;
    return (j.data as ContentItem[]) ?? [];
  };
  const firstRes = await fetch(mk(1));
  if (!firstRes.ok) return [];
  const firstJson = await firstRes.json() as any;
  const firstData: ContentItem[] = firstJson.data ?? [];
  const pag = firstJson.paginate ?? firstJson.pagination ?? firstJson.meta ?? {};
  const total = Number(pag.totalCount ?? pag.total ?? pag.totalDocs ?? 0);
  const limit = Number(pag.limit ?? pag.pageSize ?? firstData.length);
  if (total > 0 && limit > 0 && total > firstData.length) {
    const pages = Array.from({length: Math.ceil(total/limit)-1}, (_,i)=>i+2);
    const rest = await Promise.all(pages.map(fetchPage));
    return [...firstData, ...rest.flat()];
  }
  const all = [...firstData];
  for (let p=2; p<=100; p++) {
    const items = await fetchPage(p);
    if (!items.length) break;
    all.push(...items);
    if (items.length < firstData.length) break;
  }
  return all;
}

interface VideoWithMeta extends ContentItem { subjectName: string }

export default function BatchCalendar() {
  const { batchId } = useParams<{ batchId: string }>();
  const { data: batchData, isLoading: batchLoading } = useBatchDetails(batchId!);
  const batchName = batchData?.data.name ?? "Batch";
  const subjects = batchData?.data.subjects ?? [];

  // Parallel queries — one per subject
  const queries = useQueries({
    queries: subjects.map(s => ({
      queryKey: ["calVideos", batchId, s._id],
      queryFn: () => fetchAllSubjectVideos(batchId!, s._id).then(items =>
        items.map(v => ({ ...v, subjectName: s.subject } as VideoWithMeta))
      ),
      enabled: !!batchId && subjects.length > 0,
      staleTime: 1000*60*20,
      gcTime: 1000*60*120,
    })),
  });

  const isLoading = batchLoading || queries.some(q => q.isLoading);
  const allVideos: VideoWithMeta[] = queries.flatMap(q => q.data ?? []);

  const byDate = useMemo<Record<string, VideoWithMeta[]>>(() => {
    const map: Record<string, VideoWithMeta[]> = {};
    allVideos.forEach(v => {
      if (!v.date) return;
      const key = v.date.split("T")[0];
      if (!map[key]) map[key] = [];
      map[key].push(v);
    });
    return map;
  }, [allVideos]);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState<string|null>(null);

  const prevMonth = () => {
    if (viewMonth===0) { setViewYear(y=>y-1); setViewMonth(11); }
    else setViewMonth(m=>m-1);
    setSelectedKey(null);
  };
  const nextMonth = () => {
    if (viewMonth===11) { setViewYear(y=>y+1); setViewMonth(0); }
    else setViewMonth(m=>m+1);
    setSelectedKey(null);
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
  const cells: (number|null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({length: daysInMonth}, (_,i)=>i+1),
  ];
  while (cells.length%7!==0) cells.push(null);

  const todayKey = toKey(today);
  const selectedItems = selectedKey ? (byDate[selectedKey] ?? []) : [];

  const totalDays = Object.keys(byDate).length;
  const loaded = queries.filter(q=>q.isSuccess).length;

  return (
    <Layout breadcrumbs={[
      { label:"Home", href:"/" },
      { label: batchName, href:`/batch/${batchId}` },
      { label:"Calendar" },
    ]}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Calendar className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Lecture Calendar</h1>
          <p className="text-sm text-muted-foreground truncate">{batchName} · All Subjects</p>
        </div>
        {isLoading && (
          <div className="ml-auto text-xs text-muted-foreground animate-pulse shrink-0">
            {loaded}/{subjects.length} subjects loaded…
          </div>
        )}
      </div>

      {/* Main grid: calendar left, lectures right on desktop */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Calendar Card ── */}
        <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0">
          <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">

            {/* Month nav */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border/40">
              <button onClick={prevMonth} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-sm sm:text-base tracking-tight">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button onClick={nextMonth} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Weekday labels */}
            <div className="grid grid-cols-7 px-3 sm:px-4 pt-3 pb-1">
              {WEEKDAYS.map(d=>(
                <div key={d} className="text-center text-[10px] sm:text-xs font-semibold text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 px-3 sm:px-4 pb-4 gap-y-1">
              {cells.map((day, i) => {
                if (!day) return <div key={`e-${i}`} />;
                const key = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                const count = byDate[key]?.length ?? 0;
                const hasLectures = count > 0;
                const isToday = key === todayKey;
                const isSelected = key === selectedKey;

                return (
                  <motion.button
                    key={key}
                    whileHover={hasLectures ? { scale: 1.1 } : {}}
                    whileTap={hasLectures ? { scale: 0.92 } : {}}
                    onClick={() => hasLectures && setSelectedKey(isSelected ? null : key)}
                    className={`
                      relative flex flex-col items-center justify-center aspect-square rounded-xl
                      text-xs sm:text-sm font-medium transition-all
                      ${isSelected
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                        : isToday && hasLectures
                        ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                        : isToday
                        ? "ring-1 ring-border text-foreground"
                        : hasLectures
                        ? "hover:bg-muted text-foreground cursor-pointer"
                        : "text-muted-foreground/40 cursor-default"}
                    `}
                  >
                    <span>{day}</span>
                    {hasLectures && (
                      <div className="flex gap-[2px] mt-[2px]">
                        {Array.from({length: Math.min(count,3)}).map((_,di)=>(
                          <span
                            key={di}
                            className={`w-1 h-1 rounded-full ${isSelected ? "bg-primary-foreground/70" : "bg-primary"}`}
                          />
                        ))}
                        {count > 3 && (
                          <span className={`text-[8px] leading-none ${isSelected ? "text-primary-foreground/60" : "text-primary/60"}`}>+</span>
                        )}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Footer legend */}
            <div className="px-4 sm:px-5 py-3 border-t border-border/40 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary inline-block" /> Has lectures
              </span>
              {!isLoading && <span>{totalDays} days · {allVideos.length} lectures</span>}
              {isLoading && <span className="animate-pulse">Loading subjects…</span>}
            </div>
          </div>

          {/* Subject pills */}
          {!batchLoading && subjects.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {subjects.map(s=>(
                <span key={s._id} className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground border border-border/40">
                  {s.subject}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Lecture List ── */}
        <div className="flex-1 min-w-0 w-full">
          <AnimatePresence mode="wait">
            {!selectedKey ? (
              <motion.div
                key="empty"
                initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                className="flex flex-col items-center justify-center py-16 sm:py-24 text-center text-muted-foreground gap-3"
              >
                <Calendar className="w-12 h-12 opacity-20" />
                <p className="text-base font-medium">Select a date to view lectures</p>
                <p className="text-sm opacity-60">Highlighted dates have scheduled content</p>
              </motion.div>
            ) : (
              <motion.div
                key={selectedKey}
                initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
                transition={{ duration:0.2 }}
              >
                {/* Day header */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <BookOpen className="w-4 h-4 text-primary shrink-0" />
                  <h2 className="font-semibold text-sm sm:text-base">{fmtDate(selectedKey)}</h2>
                  <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
                    {selectedItems.length} lecture{selectedItems.length!==1?"s":""}
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {selectedItems.map((content, idx) => {
                    const vid = content.videoDetails;
                    const thumb = getThumb(vid);
                    const title = vid?.name ?? content.topic ?? "Lecture Video";
                    const dur = fmtDur(vid?.duration);
                    const watchUrl = `/watch?batchId=${encodeURIComponent(batchId!)}&subjectId=${encodeURIComponent((content as any).subjectId ?? "")}&videoId=${encodeURIComponent(content._id)}&title=${encodeURIComponent(title)}`;

                    return (
                      <motion.div
                        key={content._id}
                        initial={{ opacity:0, y:8 }}
                        animate={{ opacity:1, y:0 }}
                        transition={{ delay: idx*0.04 }}
                      >
                        <Link href={watchUrl}>
                          <div className="group flex gap-3 sm:gap-4 p-3 sm:p-4 bg-card border border-border/50 rounded-xl hover:border-primary/40 hover:bg-card/80 transition-all cursor-pointer">
                            {/* Thumbnail */}
                            <div className="relative w-28 sm:w-36 md:w-44 shrink-0 aspect-video rounded-lg overflow-hidden bg-muted">
                              {thumb ? (
                                <img src={thumb} alt={title} loading="lazy"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Play className="w-6 h-6 text-muted-foreground opacity-40" />
                                </div>
                              )}
                              {/* Play overlay */}
                              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                </div>
                              </div>
                              {dur && (
                                <div className="absolute bottom-1.5 right-1.5 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-medium text-white flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />{dur}
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                              {content.subjectName && (
                                <span className="text-[10px] sm:text-xs font-semibold text-primary/80 uppercase tracking-wide">
                                  {content.subjectName}
                                </span>
                              )}
                              <p className="font-semibold text-xs sm:text-sm leading-snug line-clamp-2 sm:line-clamp-3 group-hover:text-primary transition-colors">
                                {title}
                              </p>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
