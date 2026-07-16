import { useState, useEffect } from "react";

type Theme = "dark" | "light";
const KEY = "pwx_theme";

function applyTheme(t: Theme) {
  if (t === "light") {
    document.documentElement.classList.add("light");
  } else {
    document.documentElement.classList.remove("light");
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem(KEY) as Theme) ?? "dark"; }
    catch { return "dark"; }
  });

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(KEY, theme); } catch { /* noop */ }
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === "dark" ? "light" : "dark"));

  return { theme, toggleTheme, isDark: theme === "dark" };
}
