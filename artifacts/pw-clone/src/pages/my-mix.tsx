import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useCustomBatches, MixBatch } from "@/hooks/useCustomBatches";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { BookOpen, FlaskConical, Plus, Trash2, User, PlayCircle, Pencil, ArrowLeft, Layers } from "lucide-react";

function SubjectAvatar({ imageUrl, name }: { imageUrl?: string; name: string }) {
  if (imageUrl) {
    return <img src={imageUrl} alt={name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />;
  }
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-background">
      <BookOpen className="w-6 h-6 text-muted-foreground" />
    </div>
  );
}

function MixCard({ mix, onDelete, onRename }: { mix: MixBatch; onDelete: () => void; onRename: (name: string) => void }) {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(mix.name);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-card border border-border/50 rounded-xl overflow-hidden hover:border-primary/40 transition-colors"
    >
      <Link href={`/my-mix/${mix.id}`} className="block p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg leading-tight truncate hover:text-primary transition-colors">{mix.name}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {mix.subjects.length} subject{mix.subjects.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        {mix.subjects.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {mix.subjects.slice(0, 4).map(s => (
              <span key={`${s.batchId}-${s.subjectId}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium truncate max-w-[160px]">
                <FlaskConical className="w-3 h-3 flex-shrink-0" />
                {s.subjectName}
              </span>
            ))}
            {mix.subjects.length > 4 && (
              <span className="px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">
                +{mix.subjects.length - 4} more
              </span>
            )}
          </div>
        )}
        {mix.subjects.length === 0 && (
          <p className="text-sm text-muted-foreground/50 italic">No subjects added yet</p>
        )}
      </Link>

      <div className="border-t border-border/40 px-5 py-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1.5 cursor-pointer" onClick={e => { e.preventDefault(); setNewName(mix.name); setRenaming(true); }}>
          <Pencil className="w-3.5 h-3.5" /> Rename
        </Button>
        <div className="flex-1" />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 cursor-pointer" onClick={e => e.preventDefault()}>
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{mix.name}"?</AlertDialogTitle>
              <AlertDialogDescription>This will permanently remove this custom batch and all its subjects.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename Mix</DialogTitle></DialogHeader>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && newName.trim()) { onRename(newName.trim()); setRenaming(false); } }}
            placeholder="Mix name..."
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(false)}>Cancel</Button>
            <Button disabled={!newName.trim()} onClick={() => { if (newName.trim()) { onRename(newName.trim()); setRenaming(false); } }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function MixListPage() {
  const { mixes, createMix, deleteMix, renameMix } = useCustomBatches();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [, navigate] = useLocation();

  const handleCreate = () => {
    if (!newName.trim()) return;
    const id = createMix(newName.trim());
    setNewName("");
    setCreating(false);
    navigate(`/my-mix/${id}`);
  };

  return (
    <Layout breadcrumbs={[{ label: "Home", href: "/" }, { label: "My Mix" }]}>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">My Mix</h1>
          <p className="text-lg text-muted-foreground">Build custom batches from subjects across any batch.</p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2 flex-shrink-0 cursor-pointer">
          <Plus className="w-4 h-4" /> New Mix
        </Button>
      </div>

      {mixes.length === 0 && !creating && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-4">
          <Layers className="w-16 h-16 text-muted-foreground/30" />
          <h2 className="text-xl font-bold">No mixes yet</h2>
          <p className="text-muted-foreground max-w-xs">Create a mix and add subjects from any batch — Physics from one, Maths from another.</p>
          <Button onClick={() => setCreating(true)} className="gap-2 cursor-pointer"><Plus className="w-4 h-4" /> Create your first mix</Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {mixes.map(mix => (
            <MixCard
              key={mix.id}
              mix={mix}
              onDelete={() => deleteMix(mix.id)}
              onRename={name => renameMix(mix.id, name)}
            />
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Mix</DialogTitle></DialogHeader>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
            placeholder="e.g. My JEE Prep, Physics Focus..."
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button disabled={!newName.trim()} onClick={handleCreate} className="cursor-pointer">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function MixDetailPage({ mixId }: { mixId: string }) {
  const { mixes, removeSubject } = useCustomBatches();
  const mix = mixes.find(m => m.id === mixId);

  if (!mix) {
    return (
      <Layout breadcrumbs={[{ label: "Home", href: "/" }, { label: "My Mix", href: "/my-mix" }, { label: "Not Found" }]}>
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-4">
          <Layers className="w-14 h-14 text-muted-foreground/30" />
          <h2 className="text-xl font-bold">Mix not found</h2>
          <Link href="/my-mix"><Button variant="outline" className="gap-2"><ArrowLeft className="w-4 h-4" /> Back to My Mix</Button></Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout breadcrumbs={[{ label: "Home", href: "/" }, { label: "My Mix", href: "/my-mix" }, { label: mix.name }]}>
      <div className="mb-8 flex items-start gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">{mix.name}</h1>
          <p className="text-lg text-muted-foreground">
            {mix.subjects.length} subject{mix.subjects.length !== 1 ? "s" : ""} from {new Set(mix.subjects.map(s => s.batchId)).size} batch{new Set(mix.subjects.map(s => s.batchId)).size !== 1 ? "es" : ""}
          </p>
        </div>
      </div>

      {mix.subjects.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-4">
          <BookOpen className="w-14 h-14 text-muted-foreground/30" />
          <h2 className="text-xl font-bold">No subjects yet</h2>
          <p className="text-muted-foreground max-w-xs">Go to any batch, open its subjects, and click <strong>Add to Mix</strong>.</p>
          <Link href="/"><Button variant="outline">Browse Batches</Button></Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {mix.subjects.map((subject, index) => (
            <motion.div
              key={`${subject.batchId}-${subject.subjectId}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18, delay: index * 0.03 }}
              className="group bg-card border border-border/50 rounded-xl overflow-hidden hover:border-primary/40 transition-colors"
            >
              <Link href={`/batch/${subject.batchId}/subject/${subject.subjectId}`} className="flex gap-4 p-5">
                <div className="w-20 h-20 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                  <SubjectAvatar imageUrl={subject.imageUrl} name={subject.subjectName} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base leading-tight mb-1 group-hover:text-primary transition-colors line-clamp-2">
                    {subject.subjectName}
                  </h3>
                  {subject.teacherNames && (
                    <div className="flex items-center text-xs text-muted-foreground mb-2 truncate">
                      <User className="w-3 h-3 mr-1 flex-shrink-0" />
                      <span className="truncate">{subject.teacherNames}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs font-medium">
                      <PlayCircle className="w-3 h-3 mr-1" />{subject.lectureCount} Lectures
                    </span>
                  </div>
                </div>
              </Link>
              <div className="border-t border-border/40 px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                  from <span className="text-foreground font-medium">{subject.batchName}</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 text-xs h-7 cursor-pointer"
                  onClick={() => removeSubject(mix.id, subject.batchId, subject.subjectId)}
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Layout>
  );
}

export function MyMixList() {
  return <MixListPage />;
}

export function MyMixDetail() {
  const { mixId } = useParams<{ mixId: string }>();
  return <MixDetailPage mixId={mixId!} />;
}
