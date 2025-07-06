// Шапка приложения с кнопкой темы и бургером меню
// Верхняя панель навигации
import React, { useContext } from "react";
import { useSidebar } from "../context/useSidebar";
import { AuthContext } from "../context/AuthContext";
import DropdownMenu from "../components/DropdownMenu";
import NotificationDropdown from "../components/NotificationDropdown";
import { Bars3Icon, BellIcon } from "@heroicons/react/24/outline";

export default function Header() {
  const { toggle, collapsed, open } = useSidebar();
  const { token, logout } = useContext(AuthContext);
  const authItems = [
    { label: 'Профиль', href: '/profile' },
    { label: 'Выход', onClick: logout },
  ];
  return (
    <header
      className={`sticky top-0 z-10 flex h-14 items-center justify-between border-b border-stroke bg-white px-4 transition-all ${open ? (collapsed ? 'lg:ml-20' : 'lg:ml-60') : 'lg:ml-0'}`}
    >
      <div className="flex items-center gap-2">
        <button onClick={toggle} className="block" aria-label="Меню">
          <Bars3Icon className="h-6 w-6" />
        </button>
        <h1 className="font-bold">agrmcs</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative hidden sm:block">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.387a1 1 0 01-1.414 1.414l-4.387-4.387zM14 8a6 6 0 11-12 0 6 6 0 0112 0z"/></svg>
          </span>
          <input className="h-9 rounded-lg border border-gray-300 bg-gray-50 pl-8 pr-2 text-sm focus:border-brand-300 focus:outline-none" placeholder="Поиск" />
        </div>
        {token && (
          <>
            <NotificationDropdown notifications={["Новое сообщение"]}>
              <BellIcon className="h-5 w-5" />
            </NotificationDropdown>
            <DropdownMenu items={authItems} />
          </>
        )}
      </div>
    </header>
  );
}
