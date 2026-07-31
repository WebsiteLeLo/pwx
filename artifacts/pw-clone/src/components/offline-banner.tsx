import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi } from "lucide-react";
import { useState, useEffect } from "react";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";

export function OfflineBanner() {
  const isOffline = useOfflineStatus();

  // Show "Back online" flash for 3 s after reconnecting
  const [showOnline, setShowOnline] = useState(false);
  const [prevOffline, setPrevOffline] = useState(false);

  useEffect(() => {
    if (prevOffline && !isOffline) {
      setShowOnline(true);
      const t = setTimeout(() => setShowOnline(false), 3000);
      return () => clearTimeout(t);
    }
    setPrevOffline(isOffline);
    return;
  }, [isOffline]);

  const visible = isOffline || showOnline;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={isOffline ? "offline" : "online"}
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className={`fixed top-14 sm:top-16 inset-x-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium ${
            isOffline
              ? "bg-destructive text-destructive-foreground"
              : "bg-green-600 text-white"
          }`}
          style={{ transform: "translateZ(0)" }}
        >
          {isOffline ? (
            <>
              <WifiOff className="w-4 h-4 flex-shrink-0" />
              You're offline — browsing cached content
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 flex-shrink-0" />
              Back online!
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
