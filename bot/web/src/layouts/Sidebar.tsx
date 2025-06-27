// Боковое меню с навигацией по разделам
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useSidebar } from "../context/SidebarContext";
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  RectangleStackIcon,
  ChartPieIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  XMarkIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from "@heroicons/react/24/outline";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: HomeIcon },
  { to: "/tasks", label: "Задачи", icon: ClipboardDocumentListIcon },
  { to: "/tasks/kanban", label: "Канбан", icon: ClipboardDocumentListIcon },
  { to: "/projects", label: "Проекты", icon: RectangleStackIcon },
  { to: "/reports", label: "Отчёты", icon: ChartPieIcon },
  { to: "/roles", label: "Роли", icon: Cog6ToothIcon },
  { to: "/logs", label: "Логи", icon: ClipboardDocumentListIcon },
  { to: "/admin", label: "Админ", icon: Cog6ToothIcon },
  { to: "/profile", label: "Профиль", icon: UserCircleIcon },
];

export default function Sidebar() {
  const { open, toggle, collapsed, toggleCollapsed } = useSidebar();
  const { pathname } = useLocation();
  return (
    <aside
      className={`fixed top-0 left-0 z-30 h-full ${collapsed ? 'w-20' : 'w-60'} border-r border-stroke bg-white p-4 transition-all dark:border-strokedark dark:bg-boxdark ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
    >
      <div className="flex items-center justify-between">
        <button onClick={toggle} className="lg:hidden">
          <XMarkIcon className="h-5 w-5" />
        </button>
        <button
          onClick={toggleCollapsed}
          className="hidden lg:block p-1 hover:text-brand-500"
          title="Свернуть меню"
        >
          {collapsed ? (
            <ChevronDoubleRightIcon className="h-5 w-5" />
          ) : (
            <ChevronDoubleLeftIcon className="h-5 w-5" />
          )}
        </button>
      </div>
      <nav className="mt-4 space-y-2">
        {items.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            className={`flex items-center gap-2 rounded-lg px-2 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 ${pathname === i.to ? "bg-gray-100 dark:bg-gray-800 font-semibold" : ""}`}
          >
            <i.icon className="h-5 w-5" />
            {!collapsed && <span>{i.label}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
