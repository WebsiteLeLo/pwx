import { useMaintenanceMode } from "@/hooks/useAdmin";
import { Wrench } from "lucide-react";
import { motion } from "framer-motion";

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useMaintenanceMode();

  // While loading, render normally
  if (isLoading) return <>{children}</>;

  const maintenance = data?.value as { enabled: boolean; message?: string; subMessage?: string } | null;

  if (!maintenance?.enabled) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="text-center max-w-lg"
      >
        <div className="flex justify-center mb-6">
          <motion.div
            animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center shadow-2xl"
          >
            <Wrench className="w-10 h-10 text-white" />
          </motion.div>
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">
          {maintenance.message ?? "Under Maintenance"}
        </h1>
        <p className="text-zinc-400 text-lg leading-relaxed">
          {maintenance.subMessage ?? "We're working hard to improve your experience. We'll be back soon!"}
        </p>
        <div className="mt-8 flex justify-center gap-2">
          {[0, 0.2, 0.4].map((delay, i) => (
            <motion.div
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-orange-500"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.2, delay }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
