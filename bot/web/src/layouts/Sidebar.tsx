// Боковое меню с навигацией по разделам
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useSidebar } from "../context/useSidebar";
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  RectangleStackIcon,
  ChartPieIcon,
  MapIcon,
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
  { to: "/routes", label: "Маршруты", icon: MapIcon },
  { to: "/admin/roles", label: "Роли", icon: Cog6ToothIcon },
  { to: "/admin/logs", label: "Логи", icon: ClipboardDocumentListIcon },
  { to: "/profile", label: "Профиль", icon: UserCircleIcon },
];

export default function Sidebar() {
  const { open, toggle, collapsed, toggleCollapsed } = useSidebar();
  const { pathname } = useLocation();
  return (
    <aside
      className={`fixed top-0 left-0 z-30 h-full ${collapsed ? 'w-20' : 'w-60'} border-r border-stroke bg-white p-4 transition-all ${open ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <div className="flex items-center justify-between">
        <button onClick={toggle} className="p-1" aria-label="Закрыть меню">
          <XMarkIcon className="h-5 w-5" />
        </button>
        <button
          onClick={toggleCollapsed}
          className="hidden lg:block p-1 hover:text-accentPrimary"
          title="Свернуть меню"
          aria-label="Свернуть меню"
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
            className={`flex items-center gap-2 rounded-lg px-2 py-2 text-gray-700 hover:bg-gray-100 ${pathname === i.to ? "bg-gray-100 font-semibold" : ""}`}
          >
            <i.icon className="h-5 w-5" />
            {!collapsed && <span>{i.label}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
