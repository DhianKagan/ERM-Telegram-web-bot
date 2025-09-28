// Шапка приложения с кнопкой темы и бургером меню
// Верхняя панель навигации
import React from "react";
import { useSidebar } from "../context/useSidebar";
import { useAuth } from "../context/useAuth";
import ProfileDropdown from "../components/ProfileDropdown";
import ThemeToggle from "../components/ThemeToggle";
import { Bars3Icon, UserCircleIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export default function Header() {
  const { toggle } = useSidebar();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const tabClassName =
    "inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:border-primary focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/60 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-800";
  return (
    <header
      className="border-stroke sticky top-0 z-40 w-full border-b bg-white/90 px-4 py-2 shadow-sm backdrop-blur transition-colors dark:bg-slate-900/90"
      data-testid="app-header"
    >
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            className={cn(tabClassName, "text-xs")}
            aria-label={t("menu")}
            type="button"
          >
            <Bars3Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t("menu")}</span>
          </button>
          <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            ERM
          </h3>
        </div>
        <nav
          aria-label={t("menu")}
          className="flex flex-wrap items-center gap-2"
        >
          <label htmlFor="lang-select" className="sr-only">
            {t("language")}
          </label>
          <div className={tabClassName} role="presentation">
            <select
              id="lang-select"
              className="bg-transparent text-xs font-semibold uppercase tracking-wide text-slate-700 outline-none focus-visible:outline-none dark:text-slate-100"
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              aria-label={t("language")}
            >
              <option value="ru">RU</option>
              <option value="en">EN</option>
            </select>
          </div>
          {user && (
            <>
              <ThemeToggle className={tabClassName} />
              <ProfileDropdown triggerClassName={tabClassName}>
                <UserCircleIcon className="h-4 w-4" />
              </ProfileDropdown>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
