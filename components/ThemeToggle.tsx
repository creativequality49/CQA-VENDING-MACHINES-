"use client";
import { useEffect, useState } from "react";
import styles from "./ThemeToggle.module.css";
type Theme = "light" | "dark";
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const sync = () => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    sync();
    const storage = (event: StorageEvent) => {
      if (event.key !== "cqa-theme" && event.key !== null) return;
      const next = event.newValue === "dark" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
      setTheme(next);
    };
    window.addEventListener("storage", storage);
    return () => window.removeEventListener("storage", storage);
  }, []);
  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    try { localStorage.setItem("cqa-theme", next); } catch { /* The choice still works when storage is blocked. */ }
    setTheme(next);
  }
  return <button type="button" className={styles.toggle} onClick={toggle} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`} aria-pressed={theme === "dark"} title={`Current theme: ${theme}`}>
    <span aria-hidden="true">{theme === "light" ? "☀" : "☾"}</span><span className={styles.label}>{theme === "light" ? "Light" : "Dark"}</span>
  </button>;
}
