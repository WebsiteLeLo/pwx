import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useWatchlist } from "@/hooks/useWatchlist";
import { LazyImage } from "@/components/lazy-image";
import { Bookmark, Trash2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function MyList() {
  const { list, removeVideo } = useWatchlist();

  return (
    <Layout breadcrumbs={[{ label: "My List" }]}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Bookmark className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">My List</h1>
          {list.length > 0 && (
            <span className="ml-1 text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
              {list.length}
            </span>
          )}
        </div>

        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <Bookmark className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-muted-foreground font-medium">No saved videos yet</p>
            <p className="text-sm text-muted-foreground/70">
              Tap the bookmark icon on any video to save it here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {list.map((entry) => {
              const watchHref = `/watch?batchId=${entry.batchId}&subjectId=${entry.subjectId}&topicId=${entry.videoId}&videoId=${entry.videoId}`;
              return (
                <li
                  key={entry.videoId}
                  className="flex items-center gap-3 bg-card border border-border/50 rounded-xl p-3 hover:border-primary/30 transition-colors group"
                >
                  {/* Thumbnail */}
                  <Link href={watchHref} className="relative flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-muted">
                    {entry.thumbnail ? (
                      <LazyImage
                        src={entry.thumbnail}
                        alt={entry.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <Play className="w-5 h-5 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <Play className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity fill-white" />
                    </div>
                  </Link>

                  {/* Title + date */}
                  <div className="flex-1 min-w-0">
                    <Link href={watchHref}>
                      <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                        {entry.title}
                      </p>
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Saved {new Date(entry.savedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>

                  {/* Remove */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      removeVideo(entry.videoId);
                      toast("Removed from My List", { icon: "🗑️" });
                    }}
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Layout>
  );
}
