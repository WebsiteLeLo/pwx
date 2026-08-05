import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const STRIKE_KEY = "pwx_dt_strikes";

function getStrikes(): number {
  try { return parseInt(localStorage.getItem(STRIKE_KEY) ?? "0", 10) || 0; }
  catch { return 0; }
}
function addStrike(): number {
  const s = getStrikes() + 1;
  try { localStorage.setItem(STRIKE_KEY, String(s)); } catch { /* noop */ }
  return s;
}

// Mount React immediately — never block on devtools detection
createRoot(document.getElementById("root")!).render(<App />);

// Register service worker for PWA support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW registration failure is non-fatal
    });
  });
}

// Load devtools detection after React renders (fire-and-forget).
// disable-devtool accesses window.top which is blocked in cross-origin iframes,
// so we guard for PROD and catch any failure silently.
if (import.meta.env.PROD) {
  import("disable-devtool").then(({ default: DisableDevtool }) => {
    DisableDevtool({
      disableMenu: true,
      clearLog: true,
      detectors: [0, 1, 2, 3, 4, 5, 6, 7],
      ondevtoolopen: () => {
        const strikes = addStrike();
        window.dispatchEvent(
          new CustomEvent("pwx-devtools-open", { detail: { strikes } })
        );
      },
    });
  }).catch(() => {
    // Silently ignore if disable-devtool fails (sandboxed / cross-origin env)
  });
}
