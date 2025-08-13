// Переключатель светлой и тёмной темы
// Модули: React, next-themes, кнопка shadcn
import React from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Тема">
      {theme === "dark" ? "🌙" : "☀️"}
    </Button>
  );
}
