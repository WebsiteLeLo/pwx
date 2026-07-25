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
  },
  warning: {
    Icon: AlertTriangle,
    bar: "from-amber-500 to-orange-500",
    icon: "bg-amber-500/15 text-amber-400",
    border: "border-amber-500/20",
  },
  success: {
    Icon: CheckCircle,
    bar: "from-emerald-500 to-green-500",
    icon: "bg-emerald-500/15 text-emerald-400",
    border: "border-emerald-500/20",
  },
  error: {
    Icon: AlertCircle,
    bar: "from-red-500 to-rose-500",
    icon: "bg-red-500/15 text-red-400",
    border: "border-red-500/20",
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
    <>
      {/* Mobile: top full-width stack */}
      <div className="sm:hidden fixed top-0 left-0 right-0 z-[200] flex flex-col pointer-events-none">
        <AnimatePresence>
          {visible.map((n) => {
            const meta = TYPE[n.type as keyof typeof TYPE] ?? TYPE.info;
            const { Icon } = meta;
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: -40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className={`pointer-events-auto relative overflow-hidden border-b bg-zinc-900/98 backdrop-blur-md shadow-lg ${meta.border}`}
              >
                <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${meta.bar}`} />
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 ${meta.icon}`}>
                    <Icon className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white leading-snug">{n.title}</p>
                    {n.message && (
                      <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{n.message}</p>
                    )}
                    {n.link && (
                      <a
                        href={n.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-zinc-300 underline underline-offset-2"
                      >
                        {n.linkLabel ?? "Learn more"} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => setDismissed((s) => new Set([...s, n.id]))}
                    className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/60 active:bg-zinc-700 transition-all"
                    aria-label="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Desktop: bottom-right floating cards */}
      <div className="hidden sm:flex fixed bottom-4 right-4 z-[200] flex-col gap-3 w-[360px] pointer-events-none">
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
                className={`pointer-events-auto relative overflow-hidden rounded-2xl border bg-zinc-900/95 backdrop-blur-md shadow-2xl ${meta.border}`}
              >
                <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${meta.bar}`} />
                <div className="flex items-start gap-3 p-4">
                  <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${meta.icon}`}>
                    <Icon className="w-4 h-4" strokeWidth={2} />
                  </div>
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
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-zinc-300 underline underline-offset-2 hover:text-white transition-colors"
                      >
                        {n.linkLabel ?? "Learn more"} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
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
    </>
  );
}
