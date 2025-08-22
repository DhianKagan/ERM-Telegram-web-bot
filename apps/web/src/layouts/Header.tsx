// Шапка приложения с кнопкой темы и бургером меню
// Верхняя панель навигации
import React, { useContext } from "react";
import { useSidebar } from "../context/useSidebar";
import { AuthContext } from "../context/AuthContext";
import NotificationDropdown from "../components/NotificationDropdown";
import ThemeToggle from "../components/ThemeToggle";
import { Bars3Icon, BellIcon } from "@heroicons/react/24/outline";
import GlobalSearch from "../components/GlobalSearch";
import { useTranslation } from "react-i18next";

export default function Header() {
  const { toggle, collapsed, open } = useSidebar();
  const { user } = useContext(AuthContext);
  const { t, i18n } = useTranslation();
  return (
    <header
      className={`border-stroke sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-white px-4 transition-all ${open ? (collapsed ? "lg:ml-20" : "lg:ml-60") : "lg:ml-0"}`}
    >
      <div className="flex items-center gap-2">
        <button onClick={toggle} className="block" aria-label={t("menu")}>
          <Bars3Icon className="h-6 w-6" />
        </button>
        <h1 className="font-bold">agrmcs</h1>
      </div>
      <div className="flex items-center gap-4">
        <GlobalSearch />
        <select
          className="rounded border p-1 text-sm"
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
            <NotificationDropdown notifications={[t("newMessage")]}>
              <BellIcon className="h-5 w-5" />
            </NotificationDropdown>
          </>
        )}
      </div>
    </header>
  );
}
