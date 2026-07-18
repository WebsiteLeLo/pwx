import { useState, useCallback } from "react";
import { Bookmark, BookmarkCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useWatchlist } from "@/hooks/useWatchlist";

interface SaveOfflineButtonProps {
  videoId: string;
  batchId: string;
  subjectId: string;
  title: string;
  thumbnail?: string;
}

export function SaveOfflineButton({
  videoId, batchId, subjectId, title, thumbnail,
}: SaveOfflineButtonProps) {
  const { isSaved, saveVideo, removeVideo } = useWatchlist();
  const saved = isSaved(videoId);
  const [hover, setHover] = useState(false);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (saved) {
      removeVideo(videoId);
      toast("Removed from My List", { icon: "🗑️" });
    } else {
      saveVideo({ videoId, batchId, subjectId, title, thumbnail, savedAt: Date.now() });
      toast.success("Saved to My List!", {
        description: "Find it in the My List section.",
        icon: "🔖",
      });
    }
  }, [saved, videoId, batchId, subjectId, title, thumbnail, saveVideo, removeVideo]);

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={saved ? "Remove from My List" : "Save to My List"}
      className={`absolute bottom-2 left-2 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all duration-200
        ${saved
          ? hover
            ? "bg-red-500/90"
            : "bg-primary/90"
          : "bg-black/60 opacity-0 group-hover:opacity-100"
        }`}
      style={{ backdropFilter: "blur(4px)" }}
    >
      {saved
        ? hover
          ? <Trash2 className="w-3.5 h-3.5 text-white" />
          : <BookmarkCheck className="w-4 h-4 text-white" />
        : <Bookmark className="w-3.5 h-3.5 text-white" />
      }
    </button>
  );
}
