import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useBatches } from "@/hooks/usePWApi";
import { useEnrolledBatches } from "@/hooks/useEnrolledBatches";
import { useCustomBatches } from "@/hooks/useCustomBatches";
import { useWatchHistory, WatchHistoryItem } from "@/hooks/useWatchHistory";
import { Layout } from "@/components/layout";
import { LazyImage } from "@/components/lazy-image";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Calendar,
  GraduationCap,
  Loader2,
  Search,
  BookOpen,
  CheckCircle2,
  X,
  Layers,
  History,
  Play,
  Trash2,
  Share2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Batch } from "@/hooks/usePWApi";

const PAGE_SIZE = 8;

type Tab = "all" | "enrolled";

function TelegramModal({ batchName, onClose }: { batchName: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="relative bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top gradient bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#29a7e0] via-[#2196f3] to-[#29a7e0]" />

        <div className="p-6">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-[#29a7e0]/15 flex items-center justify-center">
              <svg className="w-9 h-9 text-[#29a7e0]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
            </div>
          </div>

          {/* Text */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full mb-3">
              <CheckCircle2 className="w-3 h-3" />
              Enrolled in {batchName.length > 28 ? batchName.slice(0, 28) + "…" : batchName}
            </div>
            <h2 className="text-xl font-extrabold mb-2">Join the PWX Community!</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Get updates, new batch alerts, study tips, and connect with fellow learners on our Telegram channel.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-2">
            <a
              href="https://t.me/pwxonrender"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90 active:opacity-80"
              style={{ background: "#29a7e0" }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              Join Telegram Channel
            </a>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const SITE_URL = "https://pwx.onrender.com";
const SHARE_TEXT = "🔥 PWX — Physics Wallah ke saare FREE batches ek jagah! IIT JEE, NEET, Foundation — sab free! Dekho:";

function ShareStrip() {
  const [copied, setCopied] = useState(false);

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(SHARE_TEXT + " " + SITE_URL)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(SITE_URL)}&text=${encodeURIComponent(SHARE_TEXT)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(SITE_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl border border-border/60 bg-secondary/30 px-4 py-3"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground shrink-0">
        <Share2 className="w-4 h-4 text-primary" />
        Share PWX with friends:
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 active:scale-95"
          style={{ background: "#25D366" }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp
        </a>
        <a
          href={telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 active:scale-95"
          style={{ background: "#29a7e0" }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
          Telegram
        </a>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-background hover:bg-secondary transition-colors active:scale-95"
        >
          {copied ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              <span className="text-green-500">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
              Copy Link
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ContinueWatchingSection({
  history,
  onRemove,
  onClear,
}: {
  history: WatchHistoryItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (history.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <h2 className="text-base font-bold">Continue Watching</h2>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Clear all
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
        {history.map((item) => {
          const watchUrl = `/schedule-watch?batchId=${item.batchId}&subjectId=${item.subjectId}&scheduleId=${item.scheduleId}&title=${encodeURIComponent(item.title)}${item.thumbnail ? `&thumbnail=${encodeURIComponent(item.thumbnail)}` : ""}${item.subjectName ? `&subjectName=${encodeURIComponent(item.subjectName)}` : ""}`;
          return (
            <motion.div
              key={item.scheduleId}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-shrink-0 w-52 sm:w-60 group relative"
            >
              <Link href={watchUrl} className="block">
                <div className="relative aspect-video rounded-xl overflow-hidden bg-muted mb-2">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary flex items-center justify-center">
                      <Play className="w-8 h-8 text-primary/60" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <div className="w-9 h-9 rounded-full bg-primary/90 flex items-center justify-center opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200">
                      <Play className="w-4 h-4 fill-white text-white" />
                    </div>
                  </div>
                </div>
                <p className="text-xs font-semibold line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                  {item.title}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {item.subjectName ? `${item.subjectName} · ` : ""}{timeAgo(item.watchedAt)}
                </p>
              </Link>
              <button
                onClick={() => onRemove(item.scheduleId)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/90"
                title="Remove from history"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function BatchCard({
  batch,
  index,
  enrolled,
  onEnroll,
  onUnenroll,
}: {
  batch: Batch;
  index: number;
  enrolled: boolean;
  onEnroll: (b: Batch) => void;
  onUnenroll: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.22, delay: (index % PAGE_SIZE) * 0.035 }}
      className="group relative flex flex-col bg-card rounded-xl border border-border/50 overflow-hidden hover:border-primary/50 transition-colors h-full"
      data-testid={`card-batch-${batch._id}`}
    >
      {/* Thumbnail */}
      <Link href={`/batch/${batch._id}`} className="block">
        <div className="relative aspect-video bg-muted overflow-hidden">
          {batch.previewImage ? (
            <LazyImage
              src={`${batch.previewImage.baseUrl}${batch.previewImage.key}`}
              alt={batch.name}
              fallbackText={batch.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-secondary to-background flex items-center justify-center p-6 text-center">
              <span className="font-bold text-lg text-muted-foreground">{batch.name}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
          {enrolled && (
            <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Enrolled
            </div>
          )}
        </div>
      </Link>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
            {batch.language || "English"}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
            {batch.type || "Regular"}
          </span>
        </div>

        <Link href={`/batch/${batch._id}`}>
          <h3 className="font-bold text-lg leading-tight mb-2 line-clamp-2 hover:text-primary transition-colors">
            {batch.name}
          </h3>
        </Link>

        <div className="space-y-2 pt-2">
          <div className="flex items-center text-sm text-muted-foreground gap-2">
            <GraduationCap className="w-4 h-4 shrink-0" />
            <span className="truncate">{batch.byName}</span>
          </div>
          <div className="flex items-center text-sm text-muted-foreground gap-2">
            <Calendar className="w-4 h-4 shrink-0" />
            <span>Started: {new Date(batch.startDate).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Enroll / Unenroll button */}
        <div className="mt-4 pt-4 border-t border-border/40">
          {enrolled ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="w-4 h-4 mr-1" />
                  Unenroll
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unenroll from this batch?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You are about to unenroll from{" "}
                    <span className="font-semibold text-foreground">{batch.name}</span>.
                    It will be removed from your <strong>My Batches</strong> list.
                    You can always re-enroll later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => onUnenroll(batch._id)}
                  >
                    Yes, Unenroll
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.preventDefault();
                onEnroll(batch);
              }}
            >
              <BookOpen className="w-4 h-4 mr-1" />
              Enroll
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function MixCard({ mix, index }: { mix: { id: string; name: string; createdAt: number; subjects: { subjectName: string; batchName: string }[] }; index: number }) {
  const previewSubjects = mix.subjects.slice(0, 3);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.22, delay: (index % PAGE_SIZE) * 0.035 }}
      className="group relative flex flex-col bg-card rounded-xl border border-border/50 overflow-hidden hover:border-primary/50 transition-colors h-full"
    >
      <Link href={`/my-mix/${mix.id}`} className="block">
        <div className="relative aspect-video bg-gradient-to-br from-primary/20 via-primary/10 to-background flex flex-col items-center justify-center gap-2 p-4">
          <Layers className="w-10 h-10 text-primary" />
          <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Layers className="w-3 h-3" />
            My Mix
          </div>
        </div>
      </Link>
      <div className="p-5 flex flex-col flex-1">
        <Link href={`/my-mix/${mix.id}`}>
          <h3 className="font-bold text-lg leading-tight mb-2 line-clamp-2 hover:text-primary transition-colors">
            {mix.name}
          </h3>
        </Link>
        <div className="space-y-1 mb-3">
          {previewSubjects.length > 0 ? previewSubjects.map((s, i) => (
            <div key={i} className="text-xs text-muted-foreground truncate">
              · {s.subjectName} <span className="opacity-60">({s.batchName})</span>
            </div>
          )) : (
            <div className="text-xs text-muted-foreground italic">No subjects added yet</div>
          )}
          {mix.subjects.length > 3 && (
            <div className="text-xs text-muted-foreground">+{mix.subjects.length - 3} more</div>
          )}
        </div>
        <div className="mt-auto pt-3 border-t border-border/40">
          <Link href={`/my-mix/${mix.id}`}>
            <Button size="sm" variant="outline" className="w-full gap-2">
              <Layers className="w-4 h-4" />
              Open Mix
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const { data, isLoading, isError, refetch } = useBatches();
  const { enrolled, enroll, unenroll, isEnrolled } = useEnrolledBatches();
  const { mixes } = useCustomBatches();
  const { history, removeFromHistory, clearHistory } = useWatchHistory();

  const [tgModal, setTgModal] = useState<{ batchName: string } | null>(null);

  function handleEnroll(batch: Batch) {
    enroll(batch);
    setTgModal({ batchName: batch.name });
  }

  const [tab, setTab] = useState<Tab>("enrolled");
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  const allBatches = data?.batches ?? [];

  const sourceBatches: Batch[] = tab === "enrolled" ? enrolled : allBatches;

  // Autocomplete: show matching batch names only
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return allBatches
      .filter((b) => b.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((b) => b.name);
  }, [query, allBatches]);

  const hasSuggestions = suggestions.length > 0;

  // Filter by name (matches batch name OR byName series field)
  const filtered = useMemo(() => {
    if (!query.trim()) return sourceBatches;
    const q = query.trim().toLowerCase();
    return sourceBatches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.byName?.toLowerCase().includes(q)
    );
  }, [sourceBatches, query]);

  const filteredMixes = query.trim()
    ? mixes.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
    : mixes;

  const visibleBatches = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Reset pagination when tab or query changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [tab, query]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setTimeout(() => {
      setVisibleCount((c) => c + PAGE_SIZE);
      loadingMoreRef.current = false;
    }, 400);
  }, [hasMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  if (isError) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h2 className="text-2xl font-bold">Failed to load batches</h2>
          <p className="text-muted-foreground max-w-md">
            We couldn't reach the content library. Please check your connection and try again.
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Retry Connection
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Continue Watching */}
      <ContinueWatchingSection
        history={history}
        onRemove={removeFromHistory}
        onClear={clearHistory}
      />

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-2">
          {tab === "enrolled" ? "My Enrolled Batches" : "Explore Batches"}
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground">
          {tab === "enrolled"
            ? `You have enrolled in ${enrolled.length} batch${enrolled.length !== 1 ? "es" : ""}.`
            : "Select a batch to start your preparation journey."}
        </p>
      </div>

      {/* Share strip */}
      <ShareStrip />

      {/* Tabs + Search */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Tabs */}
          <div className="flex items-center bg-secondary/50 rounded-lg p-1 gap-1 w-fit">
            <button
              onClick={() => setTab("all")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Batches
              {!isLoading && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({allBatches.length})
                </span>
              )}
            </button>
            <button
              onClick={() => setTab("enrolled")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === "enrolled"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              My Batches
              {(enrolled.length + mixes.length) > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {enrolled.length + mixes.length}
                </span>
              )}
            </button>
          </div>

          {/* Search bar with autocomplete */}
          <div className="relative flex-1 max-w-lg" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search batches or teachers..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              className="w-full pl-9 pr-9 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
            />
            {query && (
              <button
                onClick={() => { setQuery(""); setShowSuggestions(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Autocomplete dropdown */}
            <AnimatePresence>
              {showSuggestions && hasSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute z-50 top-full mt-1.5 left-0 right-0 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
                >
                  {suggestions.map((name) => (
                    <button
                      key={name}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setQuery(name);
                        setShowSuggestions(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted text-left transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>

      {/* Empty state for enrolled tab — only when no batches AND no mixes */}
      {tab === "enrolled" && enrolled.length === 0 && mixes.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-4">
          <BookOpen className="w-14 h-14 text-muted-foreground/40" />
          <h2 className="text-xl font-bold">No enrolled batches yet</h2>
          <p className="text-muted-foreground max-w-xs">
            Browse all batches and hit <strong>Enroll</strong> to add them here.
          </p>
          <Button variant="outline" onClick={() => setTab("all")}>
            Browse Batches
          </Button>
        </div>
      )}

      {/* No search results */}
      {query && filtered.length === 0 && !(tab === "enrolled" && filteredMixes.length > 0) && !isLoading && (
        <div className="flex flex-col items-center justify-center min-h-[30vh] text-center gap-3">
          <Search className="w-12 h-12 text-muted-foreground/40" />
          <h2 className="text-lg font-semibold">No results for "{query}"</h2>
          <p className="text-muted-foreground text-sm">Try a different name or teacher.</p>
          <Button variant="ghost" size="sm" onClick={() => setQuery("")}>
            Clear search
          </Button>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading && tab === "all"
          ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="w-full aspect-video rounded-xl" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-9 w-full mt-2" />
              </div>
            ))
          : (
            <AnimatePresence>
              {tab === "enrolled" && filteredMixes.map((mix, index) => (
                <MixCard key={`mix-${mix.id}`} mix={mix} index={index} />
              ))}
              {visibleBatches.map((batch, index) => (
                <BatchCard
                  key={batch._id}
                  batch={batch}
                  index={tab === "enrolled" ? filteredMixes.length + index : index}
                  enrolled={isEnrolled(batch._id)}
                  onEnroll={handleEnroll}
                  onUnenroll={unenroll}
                />
              ))}
            </AnimatePresence>
          )}
      </div>

      {/* Sentinel + loading spinner */}
      <div ref={sentinelRef} className="flex justify-center py-10">
        {!isLoading && hasMore && (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Telegram enroll modal */}
      <AnimatePresence>
        {tgModal && (
          <TelegramModal
            batchName={tgModal.batchName}
            onClose={() => setTgModal(null)}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
