import { useIsFetching } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

export function LoadingBar() {
  // Only count initial loads (status === "pending"), not background refetches/polls
  const isFetching = useIsFetching({
    predicate: (query) => query.state.status === "pending",
  });

  return (
    <AnimatePresence>
      {isFetching > 0 && (
        <motion.div
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="fixed top-0 left-0 right-0 h-[2px] bg-primary z-[9999] origin-left"
          style={{ boxShadow: "0 0 8px hsl(190 100% 50% / 0.8)" }}
        />
      )}
    </AnimatePresence>
  );
}
