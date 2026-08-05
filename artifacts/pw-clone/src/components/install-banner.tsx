import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, PlaySquare, Share } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

/** Detect iOS Safari (doesn't support beforeinstallprompt) */
function useIsIosSafari() {
  const [isIos, setIsIos] = useState(false);
  useEffect(() => {
    const ua = window.navigator.userAgent;
    const isIosDevice = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|opios|chrome/i.test(ua);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsIos(isIosDevice && isSafari && !isStandalone);
  }, []);
  return isIos;
}

const IOS_DISMISSED_KEY = "pwx_ios_install_dismissed";

export function InstallBanner() {
  const { canInstall, isInstalling, install, dismiss } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);
  const isIos = useIsIosSafari();

  // Check if user already dismissed the iOS tip
  const [iosDismissed, setIosDismissed] = useState(() => {
    try { return localStorage.getItem(IOS_DISMISSED_KEY) === "1"; }
    catch { return false; }
  });

  const handleDismiss = () => {
    setDismissed(true);
    dismiss();
  };

  const handleIosDismiss = () => {
    setIosDismissed(true);
    try { localStorage.setItem(IOS_DISMISSED_KEY, "1"); } catch { /* noop */ }
  };

  // Android/Chrome install banner
  if (canInstall && !dismissed) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed bottom-20 sm:bottom-6 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm"
          style={{ transform: "translateZ(0) translateX(-50%)" }}
        >
          <div className="flex items-center gap-3 bg-card border border-primary/30 rounded-2xl shadow-2xl px-4 py-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <PlaySquare className="w-5 h-5 text-primary-foreground fill-current" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">Install PWX App</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                Fast, offline-ready &amp; no browser bar
              </p>
            </div>
            <button
              onClick={install}
              disabled={isInstalling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold transition-opacity hover:opacity-90 active:opacity-75 disabled:opacity-60 flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              {isInstalling ? "Installing…" : "Install"}
            </button>
            <button
              onClick={handleDismiss}
              className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // iOS Safari — manual "Add to Home Screen" instructions
  if (isIos && !iosDismissed) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed bottom-4 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm"
          style={{ transform: "translateZ(0) translateX(-50%)" }}
        >
          {/* Arrow pointing down to Safari share button */}
          <div className="flex justify-center mb-1">
            <div className="w-0 h-0" style={{
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderTop: "8px solid rgba(99,102,241,0.6)",
            }} />
          </div>
          <div className="bg-card border border-primary/30 rounded-2xl shadow-2xl px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Share className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">Install PWX on iPhone</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Tap <span className="font-semibold text-foreground">Share</span>{" "}
                  <span className="inline-block">⬆</span> at the bottom, then{" "}
                  <span className="font-semibold text-foreground">"Add to Home Screen"</span>
                </p>
              </div>
              <button
                onClick={handleIosDismiss}
                className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}
