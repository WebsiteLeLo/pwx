import { useCallback, useEffect, useState } from "react";
import { Gauge, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

type PingState = "checking" | "good" | "slow" | "offline" | "error";

interface PingResult {
  state: PingState;
  latency: number | null;
  checkedAt: number | null;
  message: string;
}

const INITIAL_RESULT: PingResult = {
  state: "checking",
  latency: null,
  checkedAt: null,
  message: "Checking connection…",
};

function classifyPing(latency: number): PingState {
  if (latency <= 250) return "good";
  if (latency <= 700) return "slow";
  return "error";
}

function stateColor(state: PingState) {
  if (state === "good") return "#4ade80";
  if (state === "slow") return "#facc15";
  if (state === "checking") return "#a5b4fc";
  return "#fb7185";
}

function stateLabel(result: PingResult) {
  if (result.state === "checking") return "Checking…";
  if (result.state === "offline") return "Offline";
  if (result.state === "good") return `${result.latency ?? "—"} ms`;
  if (result.state === "slow") return `${result.latency ?? "—"} ms · Slow`;
  return result.latency ? `${result.latency} ms · Poor` : "No response";
}

export function NetworkPing({ accent = "#5a4bda" }: { accent?: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<PingResult>(INITIAL_RESULT);

  const ping = useCallback(async () => {
    if (!navigator.onLine) {
      setResult({
        state: "offline",
        latency: null,
        checkedAt: Date.now(),
        message: "Your device is offline.",
      });
      return;
    }

    setResult((current) => ({ ...current, state: "checking", message: "Checking connection…" }));
    const started = performance.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    try {
      // apiUrl already includes the configured API base ("/api" in the
      // proxied app), so adding "/api" here would request "/api/api/healthz".
      const response = await fetch(apiUrl("/healthz"), {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const latency = Math.max(1, Math.round(performance.now() - started));
      const state = classifyPing(latency);
      setResult({
        state,
        latency,
        checkedAt: Date.now(),
        message:
          state === "good"
            ? "Connection looks good."
            : "Connection may cause buffering. Try lowering video quality.",
      });
    } catch {
      setResult({
        state: navigator.onLine ? "error" : "offline",
        latency: null,
        checkedAt: Date.now(),
        message: navigator.onLine
          ? "Server did not respond. Playback may pause."
          : "Your device is offline.",
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    void ping();
    const interval = window.setInterval(() => void ping(), 30000);
    const onOnline = () => void ping();
    const onOffline = () =>
      setResult({
        state: "offline",
        latency: null,
        checkedAt: Date.now(),
        message: "Your device is offline.",
      });
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [ping]);

  const color = stateColor(result.state);

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        aria-label="Check network ping"
        title="Check network ping"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
          void ping();
        }}
        className="flex h-9 items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 text-[11px] font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
      >
        {result.state === "offline" ? (
          <WifiOff className="h-4 w-4" style={{ color }} />
        ) : (
          <Wifi className="h-4 w-4" style={{ color }} />
        )}
        <span className="hidden sm:inline">{stateLabel(result)}</span>
        <span
          className={`h-1.5 w-1.5 rounded-full ${result.state === "checking" ? "animate-pulse" : ""}`}
          style={{ background: color, boxShadow: `0 0 7px ${color}` }}
        />
      </button>

      {open && (
        <div
          className="absolute bottom-[calc(100%+8px)] right-0 z-[60] w-[230px] rounded-xl p-3 text-left"
          style={{
            background: "rgba(12,12,20,.98)",
            border: "1px solid rgba(255,255,255,.12)",
            boxShadow: "0 8px 40px rgba(0,0,0,.95)",
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-2 flex items-center gap-2">
            <Gauge className="h-4 w-4" style={{ color }} />
            <span className="text-[13px] font-semibold text-white">Network ping</span>
          </div>
          <div className="mb-1 text-[17px] font-bold text-white">{stateLabel(result)}</div>
          <p className="mb-3 text-[11px] leading-relaxed text-white/55">{result.message}</p>
          <button
            type="button"
            onClick={() => void ping()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-0 px-3 py-2 text-xs font-semibold text-white"
            style={{ background: accent }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${result.state === "checking" ? "animate-spin" : ""}`} />
            Ping again
          </button>
        </div>
      )}
    </div>
  );
}