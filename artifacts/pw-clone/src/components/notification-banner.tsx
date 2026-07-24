import { useState } from "react";
import { X, Info, AlertTriangle, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { usePublicNotifications } from "@/hooks/useAdmin";
import { motion, AnimatePresence } from "framer-motion";

const ICONS = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  error: AlertCircle,
};

const COLORS = {
  info: "bg-blue-600 text-white",
  warning: "bg-amber-500 text-white",
  success: "bg-green-600 text-white",
  error: "bg-red-600 text-white",
};

type Notification = {
  id: number;
  title: string;
  message: string;
  type: string;
  link?: string;
  linkLabel?: string;
};

export function NotificationBanner() {
  const { data: notifications = [] } = usePublicNotifications();
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const visible = (notifications as Notification[]).filter((n) => !dismissed.has(n.id));

  if (!visible.length) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex flex-col">
      <AnimatePresence>
        {visible.map((n) => {
          const Icon = ICONS[n.type as keyof typeof ICONS] ?? Info;
          const color = COLORS[n.type as keyof typeof COLORS] ?? COLORS.info;
          return (
            <motion.div
              key={n.id}
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={`${color} px-4 py-2.5 flex items-center gap-3 text-sm shadow-lg`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold">{n.title}</span>
                {n.message && <span className="ml-2 opacity-90">{n.message}</span>}
                {n.link && (
                  <a
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-3 underline underline-offset-2 inline-flex items-center gap-1 opacity-90 hover:opacity-100"
                  >
                    {n.linkLabel ?? "Learn more"} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <button
                onClick={() => setDismissed((s) => new Set([...s, n.id]))}
                className="ml-2 p-0.5 rounded hover:bg-white/20 transition-colors shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
