import { useState } from "react";
import { X, Info, AlertTriangle, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { usePublicNotifications } from "@/hooks/useAdmin";
import { motion, AnimatePresence } from "framer-motion";

const TYPE = {
  info: {
    Icon: Info,
    bar: "from-blue-500 to-cyan-500",
    icon: "bg-blue-500/15 text-blue-400",
    border: "border-blue-500/20",
    glow: "shadow-blue-500/10",
  },
  warning: {
    Icon: AlertTriangle,
    bar: "from-amber-500 to-orange-500",
    icon: "bg-amber-500/15 text-amber-400",
    border: "border-amber-500/20",
    glow: "shadow-amber-500/10",
  },
  success: {
    Icon: CheckCircle,
    bar: "from-emerald-500 to-green-500",
    icon: "bg-emerald-500/15 text-emerald-400",
    border: "border-emerald-500/20",
    glow: "shadow-emerald-500/10",
  },
  error: {
    Icon: AlertCircle,
    bar: "from-red-500 to-rose-500",
    icon: "bg-red-500/15 text-red-400",
    border: "border-red-500/20",
    glow: "shadow-red-500/10",
  },
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
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {visible.map((n) => {
          const meta = TYPE[n.type as keyof typeof TYPE] ?? TYPE.info;
          const { Icon } = meta;

          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className={`pointer-events-auto relative overflow-hidden rounded-2xl border bg-zinc-900/95 backdrop-blur-md shadow-2xl ${meta.border} ${meta.glow}`}
            >
              {/* Gradient top bar */}
              <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${meta.bar}`} />

              <div className="flex items-start gap-3 p-4">
                {/* Icon */}
                <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${meta.icon}`}>
                  <Icon className="w-4.5 h-4.5" strokeWidth={2} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm font-semibold text-white leading-snug">{n.title}</p>
                  {n.message && (
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{n.message}</p>
                  )}
                  {n.link && (
                    <a
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`mt-2 inline-flex items-center gap-1 text-xs font-medium transition-opacity opacity-80 hover:opacity-100 bg-gradient-to-r ${meta.bar} bg-clip-text text-transparent`}
                    >
                      {n.linkLabel ?? "Learn more"}
                      <ExternalLink className="w-3 h-3 text-current opacity-70" />
                    </a>
                  )}
                </div>

                {/* Dismiss */}
                <button
                  onClick={() => setDismissed((s) => new Set([...s, n.id]))}
                  className="shrink-0 mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/60 transition-all"
                  aria-label="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
