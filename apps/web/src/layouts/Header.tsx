// Шапка приложения с кнопкой темы и бургером меню
// Верхняя панель навигации
import React from "react";
import { useSidebar } from "../context/useSidebar";
import { useAuth } from "../context/useAuth";
import ProfileDropdown from "../components/ProfileDropdown";
import ThemeToggle from "../components/ThemeToggle";
import { Bars3Icon, UserCircleIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

export default function Header() {
  const { toggle } = useSidebar();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  return (
    <header
      className="border-stroke sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b bg-white/90 px-4 shadow-sm backdrop-blur transition-colors dark:bg-slate-900/90"
      data-testid="app-header"
    >
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="flex h-12 w-12 items-center justify-center"
          aria-label={t("menu")}
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
        <h1 className="font-bold">ERM</h1>
      </div>
      <div className="flex items-center gap-4">
        <label htmlFor="lang-select" className="sr-only">
          {t("language")}
        </label>
        <select
          id="lang-select"
          className="h-12 rounded border px-2 text-sm"
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          aria-label={t("language")}
        >
          <option value="ru">RU</option>
          <option value="en">EN</option>
        </select>
        {user && (
          <>
            <ThemeToggle />
            <ProfileDropdown>
              <UserCircleIcon className="h-5 w-5" />
            </ProfileDropdown>
          </>
        )}
      </div>
    </header>
  );
}
