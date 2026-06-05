import { useState, useEffect, useMemo, useCallback } from "react";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Folder, FileText, File, Download, Eye, AlertCircle,
  ChevronRight, Home, Search, X, BookOpen,
} from "lucide-react";

const ROOT_FOLDER_ID = "1YvTCNTURZg9o7iS23S7wEnrk0rKgQOXw";
const FOLDER_MIME = "application/vnd.google-apps.folder";

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
}

interface BreadcrumbEntry {
  id: string;
  name: string;
}

async function fetchDriveItems(folderId: string): Promise<DriveItem[]> {
  const { apiUrl } = await import("@/lib/apiUrl");
  const url = apiUrl(`/api/drive/files?folderId=${encodeURIComponent(folderId)}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`);
  const json = await res.json() as { files?: DriveItem[] };
  return json.files ?? [];
}

function fileTypeLabel(mimeType: string): string {
  if (mimeType === FOLDER_MIME) return "Folder";
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("document") || mimeType.includes("word")) return "DOC";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "XLS";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "PPT";
  if (mimeType.includes("image")) return "IMG";
  if (mimeType.includes("video")) return "VID";
  return "FILE";
}

function fileTypeBadgeClass(mimeType: string): string {
  if (mimeType.includes("pdf")) return "bg-red-500/10 text-red-400";
  if (mimeType.includes("document") || mimeType.includes("word")) return "bg-blue-500/10 text-blue-400";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "bg-green-500/10 text-green-400";
  if (mimeType.includes("presentation")) return "bg-orange-500/10 text-orange-400";
  if (mimeType.includes("image")) return "bg-purple-500/10 text-purple-400";
  return "bg-muted text-muted-foreground";
}

function formatSize(size?: string): string {
  if (!size) return "";
  const n = parseInt(size, 10);
  if (isNaN(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

interface FolderCardProps { item: DriveItem; onClick: () => void }
function FolderCard({ item, onClick }: FolderCardProps) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 bg-card rounded-xl border border-border/50 hover:border-primary/40 hover:bg-card/80 transition-all text-left group"
    >
      <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center flex-shrink-0">
        <Folder className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{item.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Folder</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
    </motion.button>
  );
}

interface FileCardProps { item: DriveItem }
function FileCard({ item }: FileCardProps) {
  const isPdf = item.mimeType.includes("pdf");
  const isGoogleDoc = item.mimeType.includes("google-apps.document");
  const previewUrl = isPdf
    ? `https://drive.google.com/file/d/${item.id}/preview`
    : isGoogleDoc
    ? `https://docs.google.com/document/d/${item.id}/preview`
    : null;
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${item.id}`;
  const viewUrl = `https://drive.google.com/file/d/${item.id}/view`;

  const [showPreview, setShowPreview] = useState(false);
  const label = fileTypeLabel(item.mimeType);
  const badgeClass = fileTypeBadgeClass(item.mimeType);
  const size = formatSize(item.size);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border/50 hover:border-primary/20 transition-all"
      >
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          {isPdf ? <FileText className="w-5 h-5" /> : <File className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{item.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeClass}`}>{label}</span>
            {size && <span className="text-xs text-muted-foreground">{size}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {previewUrl && (
            <Button size="sm" variant="outline" onClick={() => setShowPreview(true)} className="h-8 gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </Button>
          )}
          <Button size="sm" variant="outline" asChild className="h-8 gap-1.5">
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>
          </Button>
          <Button size="sm" variant="ghost" asChild className="h-8">
            <a href={viewUrl} target="_blank" rel="noopener noreferrer">
              <Eye className="w-3.5 h-3.5" />
            </a>
          </Button>
        </div>
      </motion.div>

      {/* PDF Preview Modal */}
      <AnimatePresence>
        {showPreview && previewUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-4xl h-[85vh] bg-card rounded-2xl overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
                <p className="font-semibold text-sm truncate">{item.name}</p>
                <Button size="sm" variant="ghost" onClick={() => setShowPreview(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <iframe
                src={previewUrl}
                className="flex-1 w-full"
                title={item.name}
                allow="autoplay"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function Materials() {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([
    { id: ROOT_FOLDER_ID, name: "JEE Materials" },
  ]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const currentFolder = breadcrumbs[breadcrumbs.length - 1];

  const loadFolder = useCallback(async (folderId: string) => {
    setIsLoading(true);
    setError(null);
    setSearch("");
    try {
      const data = await fetchDriveItems(folderId);
      setItems(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolder(currentFolder.id);
  }, [currentFolder.id, loadFolder]);

  const openFolder = (item: DriveItem) => {
    setBreadcrumbs(prev => [...prev, { id: item.id, name: item.name }]);
  };

  const navigateTo = (index: number) => {
    setBreadcrumbs(prev => prev.slice(0, index + 1));
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(q));
  }, [items, search]);

  const folders = filtered.filter(i => i.mimeType === FOLDER_MIME);
  const files = filtered.filter(i => i.mimeType !== FOLDER_MIME);

  const layoutBreadcrumbs = [
    { label: "Home", href: "/" },
    ...breadcrumbs.map((b, i) => ({
      label: b.name,
      href: i < breadcrumbs.length - 1 ? undefined : undefined,
    })),
  ];

  return (
    <Layout breadcrumbs={layoutBreadcrumbs}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">JEE Materials</h1>
            <p className="text-muted-foreground">Free study resources for JEE aspirants</p>
          </div>
        </div>
      </div>

      {/* Folder Breadcrumb Trail */}
      <div className="flex items-center gap-1.5 flex-wrap mb-6">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          return (
            <div key={crumb.id} className="flex items-center gap-1.5">
              {i === 0 ? (
                <button
                  onClick={() => !isLast && navigateTo(0)}
                  className={`flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-lg transition-colors ${
                    isLast
                      ? "bg-primary/10 text-primary cursor-default"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  {crumb.name}
                </button>
              ) : (
                <button
                  onClick={() => !isLast && navigateTo(i)}
                  className={`text-sm font-medium px-2.5 py-1 rounded-lg transition-colors ${
                    isLast
                      ? "bg-primary/10 text-primary cursor-default"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {crumb.name}
                </button>
              )}
              {!isLast && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />}
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={`Search in ${currentFolder.name}…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 pr-9"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <AlertCircle className="w-10 h-10 text-destructive" />
          <p className="text-muted-foreground">Failed to load materials.</p>
          <p className="text-sm text-muted-foreground/70">{error}</p>
          <Button onClick={() => loadFolder(currentFolder.id)} variant="outline" size="sm">
            Retry
          </Button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Folder className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">
            {search ? "No results found" : "This folder is empty"}
          </p>
          {search && <p className="text-sm mt-1">Try a different search term</p>}
        </div>
      )}

      {/* Folders */}
      {!isLoading && !error && folders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Folders ({folders.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {folders.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: idx * 0.03 }}
              >
                <FolderCard item={item} onClick={() => openFolder(item)} />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      {!isLoading && !error && files.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Files ({files.length})
          </h2>
          <div className="space-y-3">
            {files.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: idx * 0.02 }}
              >
                <FileCard item={item} />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
