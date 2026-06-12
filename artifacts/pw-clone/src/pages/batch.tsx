import { useState } from "react";
import { useBatchDetails } from "@/hooks/usePWApi";
import { useCustomBatches, MixSubject } from "@/hooks/useCustomBatches";
import { Layout } from "@/components/layout";
import { LazyImage } from "@/components/lazy-image";
import { Link, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AlertCircle, BookOpen, User, PlayCircle, Plus, Check, Layers, Share2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

function AddToMixDialog({
  open,
  onClose,
  subject,
  batchId,
  batchName,
}: {
  open: boolean;
  onClose: () => void;
  subject: MixSubject;
  batchId: string;
  batchName: string;
}) {
  const { mixes, createMix, addSubject, isSubjectInMix } = useCustomBatches();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const id = createMix(newName.trim());
    addSubject(id, subject);
    setNewName("");
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Mix</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">
          Adding <span className="font-semibold text-foreground">{subject.subjectName}</span>
          {" "}from <span className="font-semibold text-foreground">{batchName}</span>
        </p>

        {mixes.length === 0 && !creating && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            No mixes yet. Create one below.
          </div>
        )}

        {mixes.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {mixes.map(mix => {
              const added = isSubjectInMix(mix.id, batchId, subject.subjectId);
              return (
                <button
                  key={mix.id}
                  onClick={() => { if (!added) { addSubject(mix.id, subject); onClose(); } }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${
                    added
                      ? "border-primary/30 bg-primary/5 cursor-default"
                      : "border-border/50 hover:border-primary/40 hover:bg-muted cursor-pointer"
                  }`}
                >
                  <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{mix.name}</p>
                    <p className="text-xs text-muted-foreground">{mix.subjects.length} subjects</p>
                  </div>
                  {added && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {creating ? (
          <div className="flex gap-2 pt-1">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
              placeholder="Mix name..."
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <Button size="sm" disabled={!newName.trim()} onClick={handleCreate} className="cursor-pointer">Create</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)} className="cursor-pointer">Cancel</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="gap-2 cursor-pointer" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" /> New Mix
          </Button>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="cursor-pointer">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Batch() {
  const { batchId } = useParams<{ batchId: string }>();
  const { data, isLoading, isError, refetch } = useBatchDetails(batchId!);
  const { getSubjectMixes } = useCustomBatches();
  const [dialogSubject, setDialogSubject] = useState<MixSubject | null>(null);
  const [copied, setCopied] = useState(false);

  if (isError) {
    return (
      <Layout breadcrumbs={[{ label: "Home", href: "/" }, { label: "Error" }]}>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h2 className="text-2xl font-bold">Failed to load subjects</h2>
          <p className="text-muted-foreground max-w-md">
            We couldn't retrieve the batch details. Please check your connection and try again.
          </p>
          <Button onClick={() => refetch()} variant="outline">Retry Connection</Button>
        </div>
      </Layout>
    );
  }

  const batchName = data?.data.name || "Loading...";

  const handleShare = async () => {
    const url = apiUrl(`/og/batch/${batchId}`);
    try {
      if (navigator.share) {
        await navigator.share({ title: batchName, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  };

  return (
    <Layout breadcrumbs={[{ label: "Home", href: "/" }, { label: batchName }]}>
      <div className="mb-6 sm:mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-2">Subjects</h1>
          <p className="text-base sm:text-lg text-muted-foreground">Master your concepts subject by subject.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          title="Share this batch"
          className="flex items-center gap-2 flex-shrink-0 mt-1"
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
          <span className="hidden sm:inline">{copied ? "Copied!" : "Share"}</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 p-4 border border-border/50 rounded-xl">
              <Skeleton className="w-24 h-24 rounded-lg" />
              <div className="flex flex-col flex-1 gap-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3 mt-auto" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {data?.data.subjects.map((subject, index) => {
              const imageUrl = subject.imageId
                ? `${subject.imageId.baseUrl}${subject.imageId.key}`
                : undefined;
              const teacherNames = subject.teacherIds
                ? subject.teacherIds.map(t => `${t.firstName} ${t.lastName}`).join(", ")
                : "";
              const inMixCount = getSubjectMixes(batchId!, subject._id).length;

              const mixSubject: MixSubject = {
                batchId: batchId!,
                batchName,
                subjectId: subject._id,
                subjectName: subject.subject,
                teacherNames,
                lectureCount: subject.lectureCount || 0,
                imageUrl,
              };

              return (
                <motion.div
                  key={subject._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: index * 0.03 }}
                  className="group relative bg-card rounded-xl border border-border/50 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 overflow-hidden"
                >
                  <Link href={`/batch/${batchId}/subject/${subject._id}`} className="flex gap-5 p-5">
                    <div className="w-24 h-24 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                      {subject.imageId ? (
                        <LazyImage
                          src={imageUrl!}
                          alt={subject.subject}
                          fallbackText={subject.subject[0]}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-background">
                          <BookOpen className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col flex-1 min-w-0">
                      <h3 className="font-bold text-lg leading-tight mb-1 truncate group-hover:text-primary transition-colors">
                        {subject.subject}
                      </h3>

                      {subject.teacherIds && subject.teacherIds.length > 0 && (
                        <div className="flex items-center text-sm text-muted-foreground mb-3 truncate">
                          <User className="w-4 h-4 mr-1 flex-shrink-0" />
                          <span className="truncate">{teacherNames}</span>
                        </div>
                      )}

                      <div className="mt-auto flex items-center gap-3">
                        <span className="inline-flex items-center px-2 py-1 rounded bg-secondary text-secondary-foreground text-xs font-medium">
                          <PlayCircle className="w-3 h-3 mr-1" />
                          {subject.lectureCount || 0} Lectures
                        </span>
                        {inMixCount > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-primary/10 text-primary text-xs font-medium gap-1">
                            <Layers className="w-3 h-3" /> In {inMixCount} mix{inMixCount !== 1 ? "es" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>

                  <div className="border-t border-border/40 px-5 py-2.5 flex items-center justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs h-7 text-muted-foreground hover:text-primary cursor-pointer"
                      onClick={e => { e.preventDefault(); setDialogSubject(mixSubject); }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add to Mix
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {(!data?.data.subjects || data.data.subjects.length === 0) && (
            <div className="col-span-full flex flex-col items-center justify-center p-12 bg-card rounded-xl border border-border/50">
              <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-bold">No Subjects Found</h3>
              <p className="text-muted-foreground">This batch currently has no published subjects.</p>
            </div>
          )}
        </div>
      )}

      {dialogSubject && (
        <AddToMixDialog
          open={!!dialogSubject}
          onClose={() => setDialogSubject(null)}
          subject={dialogSubject}
          batchId={batchId!}
          batchName={batchName}
        />
      )}
    </Layout>
  );
}
