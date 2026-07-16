import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, Clock, Calendar, BookOpen } from "lucide-react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useAllSubjectVideos, useBatchDetails, ContentItem } from "@/hooks/usePWApi";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function formatDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function getVideoThumb(vid: any): string | null {
  if (!vid) return null;
  if (vid.image) return vid.image;
  const imageId = vid.imageId;
  if (!imageId) return null;
  if (typeof imageId === "string") return imageId;
  if (imageId.baseUrl && imageId.key) return `${imageId.baseUrl}${imageId.key}`;
  return null;
}

function fmtDur(raw: string | number | undefined) {
  if (!raw) return null;
  const s = String(raw);
  if (s.includes(":")) return s;
  const secs = Number(s);
  if (isNaN(secs)) return s;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const sec = secs % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`
    : `${m}:${String(sec).padStart(2,"0")}`;
}

export default function SubjectCalendar() {
  const { batchId, subjectId } = useParams<{ batchId: string; subjectId: string }>();
  const { data: batchData } = useBatchDetails(batchId!);
  const { data: videos, isLoading } = useAllSubjectVideos(batchId!, subjectId!);

  const batchName = batchData?.data.name ?? "Batch";
  const subjectName = batchData?.data.subjects.find(s => s._id === subjectId)?.subject ?? "Subject";

  // group videos by date key
  const byDate = useMemo<Record<string, ContentItem[]>>(() => {
    const map: Record<string, ContentItem[]> = {};
    (videos ?? []).forEach(v => {
      if (!v.date) return;
      const raw = v.date.split("T")[0]; // "YYYY-MM-DD"
      if (!map[raw]) map[raw] = [];
      map[raw].push(v);
    });
    return map;
  }, [videos]);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedKey(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedKey(null);
  };

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = toKey(today);
  const selectedItems = selectedKey ? (byDate[selectedKey] ?? []) : [];

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: batchName, href: `/batch/${batchId}` },
    { label: subjectName, href: `/batch/${batchId}/subject/${subjectId}` },
    { label: "Calendar" },
  ];

  return (
    <Layout breadcrumbs={breadcrumbs}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Calendar className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lecture Calendar</h1>
          <p className="text-sm text-muted-foreground">{subjectName} · {batchName}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Calendar ── */}
        <div className="lg:w-[420px] shrink-0">
          <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
            {/* Month nav */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <button onClick={prevMonth} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-base tracking-tight">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button onClick={nextMonth} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Weekday labels */}
            <div className="grid grid-cols-7 px-4 pt-3 pb-1">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 px-4 pb-4 gap-y-1">
              {cells.map((day, i) => {
                if (!day) return <div key={`e-${i}`} />;
                const key = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                const hasLectures = !!byDate[key];
                const count = byDate[key]?.length ?? 0;
                const isToday = key === todayKey;
                const isSelected = key === selectedKey;

                return (
                  <motion.button
                    key={key}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedKey(isSelected ? null : key)}
                    className={`
                      relative flex flex-col items-center justify-center aspect-square rounded-xl text-sm font-medium transition-all
                      ${isSelected ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                        : isToday ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                        : hasLectures ? "hover:bg-muted text-foreground"
                        : "text-muted-foreground/50 cursor-default"}
                    `}
                    disabled={!hasLectures && !isToday}
                  >
                    <span>{day}</span>
                    {hasLectures && (
                      <div className="flex gap-0.5 mt-0.5">
                        {Array.from({ length: Math.min(count, 3) }).map((_, di) => (
                          <span
                            key={di}
                            className={`w-1 h-1 rounded-full ${isSelected ? "bg-primary-foreground/70" : "bg-primary"}`}
                          />
                        ))}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="px-5 py-3 border-t border-border/40 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary inline-block" /> Has lectures
              </span>
              {isLoading && <span className="animate-pulse">Loading…</span>}
              {!isLoading && (
                <span>{Object.keys(byDate).length} days with content</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Lecture list ── */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {!selectedKey ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground gap-3"
              >
                <Calendar className="w-12 h-12 opacity-20" />
                <p className="text-base font-medium">Pick a date to see lectures</p>
                <p className="text-sm opacity-60">Dates with dots have scheduled content</p>
              </motion.div>
            ) : (
              <motion.div
                key={selectedKey}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <h2 className="font-semibold text-sm">{formatDateKey(selectedKey)}</h2>
                  <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {selectedItems.length} lecture{selectedItems.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {selectedItems.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No lectures on this day.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {selectedItems.map((content, idx) => {
                      const vid = content.videoDetails;
                      const thumb = getVideoThumb(vid);
                      const title = vid?.name ?? content.topic ?? "Lecture Video";
                      const dur = fmtDur(vid?.duration);
                      const watchUrl = `/watch?batchId=${encodeURIComponent(batchId!)}&subjectId=${encodeURIComponent(subjectId!)}&videoId=${encodeURIComponent(content._id)}&title=${encodeURIComponent(title)}`;

                      return (
                        <motion.div
                          key={content._id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                        >
                          <Link href={watchUrl}>
                            <div className="group flex gap-4 p-3 bg-card border border-border/50 rounded-xl hover:border-primary/40 hover:bg-card/80 transition-all cursor-pointer">
                              {/* Thumbnail */}
                              <div className="relative w-32 sm:w-40 shrink-0 aspect-video rounded-lg overflow-hidden bg-muted">
                                {thumb ? (
                                  <img src={thumb} alt={title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Play className="w-6 h-6 text-muted-foreground opacity-40" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                  <div className="w-8 h-8 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                  </div>
                                </div>
                                {dur && (
                                  <div className="absolute bottom-1.5 right-1.5 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-medium text-white flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" />
                                    {dur}
                                  </div>
                                )}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0 py-1">
                                <p className="font-semibold text-sm leading-snug line-clamp-3 group-hover:text-primary transition-colors">
                                  {title}
                                </p>
                                {content.topic && vid?.name && content.topic !== vid.name && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{content.topic}</p>
                                )}
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
