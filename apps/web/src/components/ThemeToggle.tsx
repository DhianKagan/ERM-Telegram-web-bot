// Переключатель светлой и тёмной темы
// Модули: React, контекст темы, кнопка shadcn
import React, { useContext } from "react";
import { Button } from "@/components/ui/button";
import { ThemeContext } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, setTheme } = useContext(ThemeContext);
  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Тема">
      {theme === "dark" ? "🌙" : "☀️"}
    </Button>
  );
}
