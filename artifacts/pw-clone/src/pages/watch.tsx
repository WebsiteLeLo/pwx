import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, PlaySquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Watch() {
  const [params, setParams] = useState({
    batchId: "",
    childId: "",
    ContentId: "",
  });

  useEffect(() => {
    // Parse URL params
    const searchParams = new URLSearchParams(window.location.search);
    setParams({
      batchId: searchParams.get("batchId") || "",
      childId: searchParams.get("childId") || "",
      ContentId: searchParams.get("ContentId") || "",
    });
  }, []);

  const iframeSrc = `https://videoplayerofpw.onrender.com/?batchId=${params.batchId}&childId=${params.childId}&ContentId=${params.ContentId}`;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-black text-white">
      {/* Minimal Chrome Nav */}
      <header className="absolute top-0 w-full z-50 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between pointer-events-none">
        <Button 
          variant="ghost" 
          className="text-white hover:bg-white/20 hover:text-white pointer-events-auto"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </Button>

        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground">
            <PlaySquare className="w-3.5 h-3.5 fill-current" />
          </div>
          <span className="font-bold tracking-tight">
            PW<span className="text-primary">X</span>
          </span>
        </div>
      </header>

      {/* Player Container */}
      <main className="flex-1 w-full h-[100dvh] flex items-center justify-center bg-black">
        {params.childId ? (
          <iframe
            src={iframeSrc}
            allowFullScreen
            className="w-full h-full border-0"
            title="PW Video Player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        ) : (
          <div className="text-center text-muted-foreground">
            <p>Invalid video parameters. Please return and select a video.</p>
          </div>
        )}
      </main>
    </div>
  );
}
