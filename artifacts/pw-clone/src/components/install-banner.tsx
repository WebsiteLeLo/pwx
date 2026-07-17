import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, PlaySquare } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

export function InstallBanner() {
  const { canInstall, isInstalling, install, dismiss } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    dismiss();
  };

  const show = canInstall && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm"
          style={{ transform: "translateZ(0) translateX(-50%)" }}
        >
          <div className="flex items-center gap-3 bg-card border border-primary/30 rounded-2xl shadow-2xl px-4 py-3">
            {/* App icon */}
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <PlaySquare className="w-5 h-5 text-primary-foreground fill-current" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">Install PWX App</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                Fast, offline-ready &amp; no browser bar
              </p>
            </div>

            {/* Install button */}
            <button
              onClick={install}
              disabled={isInstalling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold transition-opacity hover:opacity-90 active:opacity-75 disabled:opacity-60 flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              {isInstalling ? "Installing…" : "Install"}
            </button>

            {/* Close */}
            <button
              onClick={handleDismiss}
              className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
              aria-label="Dismiss install prompt"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
