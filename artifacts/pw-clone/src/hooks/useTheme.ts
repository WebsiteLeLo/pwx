import { useState, useEffect } from "react";

type Theme = "light" | "dark";

const KEY = "pwx_theme";

function applyTheme(t: Theme) {
  if (t === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(KEY) as Theme) ?? "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(KEY, theme); } catch { /* noop */ }
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === "dark" ? "light" : "dark"));

  return { theme, toggleTheme, isDark: theme === "dark" };
}
