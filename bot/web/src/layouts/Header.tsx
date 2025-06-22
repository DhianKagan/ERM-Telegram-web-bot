// Шапка приложения с кнопкой темы и бургером меню
import React from "react";
import { useSidebar } from "../context/SidebarContext";
import { useTheme } from "../context/ThemeContext";

export default function Header() {
  const { toggle } = useSidebar();
  const { theme, toggle: toggleTheme } = useTheme();
  return (
    <header className="flex h-12 items-center justify-between border-b border-gray-200 bg-white pr-8 pl-4 md:ml-52 dark:border-gray-800 dark:bg-gray-900">
      <button onClick={toggle} className="md:hidden">
        ☰
      </button>
      <h1 className="font-bold">agrmcs</h1>
      <button onClick={toggleTheme}>{theme === "light" ? "🌞" : "🌜"}</button>
    </header>
  );
}
