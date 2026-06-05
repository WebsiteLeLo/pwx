import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "pwx_dt_strikes";

function getStrikes(): number {
  try { return parseInt(localStorage.getItem(STORAGE_KEY) ?? "0", 10) || 0; }
  catch { return 0; }
}

function addStrike(): number {
  const s = getStrikes() + 1;
  try { localStorage.setItem(STORAGE_KEY, String(s)); } catch { /* noop */ }
  return s;
}

function isDevToolsOpen(): boolean {
  const widthThreshold  = window.outerWidth  - window.innerWidth  > 160;
  const heightThreshold = window.outerHeight - window.innerHeight > 160;
  return widthThreshold || heightThreshold;
}

export function useDevToolsDetection() {
  const [detected, setDetected] = useState(false);
  const [strikes, setStrikes]   = useState(getStrikes);
  const wasOpen = useRef(false);

  useEffect(() => {
    let blocked = false;

    const check = () => {
      if (blocked) return;
      const open = isDevToolsOpen();
      if (open && !wasOpen.current) {
        wasOpen.current = true;
        blocked = true;
        const s = addStrike();
        setStrikes(s);
        setDetected(true);
      } else if (!open) {
        wasOpen.current = false;
      }
    };

    const interval = setInterval(check, 500);

    const onResize = () => check();
    window.addEventListener("resize", onResize);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const dismiss = () => setDetected(false);

  return { detected, strikes, dismiss };
}
