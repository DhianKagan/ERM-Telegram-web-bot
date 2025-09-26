// Переключатель светлой и тёмной темы
// Модули: React, контекст темы, кнопка shadcn
import React, { useContext } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeContext } from "../context/ThemeContext";

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useContext(ThemeContext);
  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label="Тема"
      className={cn(
        "h-auto rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-white focus-visible:ring-2 focus-visible:ring-primary/60 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-800",
        className,
      )}
    >
      {theme === "dark" ? "🌙" : "☀️"}
    </Button>
  );
}
