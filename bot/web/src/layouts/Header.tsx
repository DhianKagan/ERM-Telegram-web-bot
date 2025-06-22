// Шапка приложения с кнопкой темы и бургером меню
// Верхняя панель навигации
import React from "react";
import { useSidebar } from "../context/SidebarContext";
import { useTheme } from "../context/ThemeContext";
import {
  Bars3Icon,
  BellIcon,
  SunIcon,
  MoonIcon,
} from "@heroicons/react/24/outline";

export default function Header() {
  const { toggle } = useSidebar();
  const { theme, toggle: toggleTheme } = useTheme();
  return (
    <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b bg-white px-4 md:ml-52 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <button onClick={toggle} className="md:hidden">
          <Bars3Icon className="h-6 w-6" />
        </button>
        <h1 className="font-bold">agrmcs</h1>
      </div>
      <div className="flex items-center gap-4">
        <input
          className="rounded-md border border-gray-300 bg-gray-50 px-2 text-sm focus:outline-none dark:border-gray-700 dark:bg-gray-800"
          placeholder="Поиск"
        />
        <button onClick={toggleTheme}>
          {theme === 'light' ? (
            <SunIcon className="h-5 w-5" />
          ) : (
            <MoonIcon className="h-5 w-5" />
          )}
        </button>
        <button>
          <BellIcon className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
