// Боковое меню с навигацией по разделам
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useSidebar } from "../context/useSidebar";
import { useAuth } from "../context/useAuth";
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

const baseItems = [
  { to: "/tasks", label: "Задачи", icon: ClipboardDocumentListIcon },
  { to: "/profile", label: "Профиль", icon: UserCircleIcon },
];

const adminExtra = [
  { to: "/cp/kanban", label: "Канбан", icon: ClipboardDocumentListIcon },
  { to: "/cp/reports", label: "Отчёты", icon: ChartPieIcon },
  { to: "/cp/routes", label: "Маршруты", icon: MapIcon },
  { to: "/cp/roles", label: "Роли", icon: Cog6ToothIcon },
  { to: "/cp/logs", label: "Логи", icon: Cog6ToothIcon },
  { to: "/cp/storage", label: "Файлы", icon: RectangleStackIcon },
];

export default function Sidebar() {
  const { open, toggle, collapsed, toggleCollapsed } = useSidebar();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const role = user?.role || "user";
  const items = React.useMemo(() => {
    return role === "admin" ? [...baseItems, ...adminExtra] : baseItems;
  }, [role]);
  return (
    <aside
      className={`fixed top-0 left-0 z-50 h-full ${collapsed ? "w-20" : "w-60"} border-stroke border-r bg-white p-4 transition-all ${open ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="flex items-center justify-between">
        <button
          onClick={toggle}
          className="flex h-12 w-12 items-center justify-center"
          aria-label="Закрыть меню"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
        <button
          onClick={toggleCollapsed}
          className="hover:text-accentPrimary hidden h-12 w-12 items-center justify-center lg:flex"
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
            aria-label={i.label}
            className={`flex h-12 items-center gap-2 rounded-lg px-2 text-gray-700 hover:bg-gray-100 ${pathname === i.to ? "bg-gray-100 font-semibold" : ""}`}
          >
            <i.icon className="h-5 w-5" />
            {!collapsed && <span>{i.label}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
