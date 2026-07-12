"use client";

import { useEffect, useState } from "react";

type ThemeId = "classic" | "noir" | "editorial";

const THEMES: { id: ThemeId; label: string }[] = [
  { id: "classic", label: "Классик" },
  { id: "noir", label: "Нуар" },
  { id: "editorial", label: "Издание" },
];

const STORAGE_KEY = "bfl-theme";

function applyTheme(theme: ThemeId): void {
  if (theme === "classic") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

/** Переключатель трёх вариантов дизайна; выбор живёт в localStorage */
export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>("classic");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (saved && THEMES.some((t) => t.id === saved)) {
      setTheme(saved);
      applyTheme(saved);
    }
  }, []);

  const select = (next: ThemeId): void => {
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full border border-line bg-surface p-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => select(t.id)}
          aria-pressed={theme === t.id}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
            theme === t.id
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
