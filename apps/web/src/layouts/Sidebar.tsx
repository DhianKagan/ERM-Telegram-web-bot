// Боковое меню с навигацией по разделам
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useSidebar } from "../context/useSidebar";
import { useAuth } from "../context/useAuth";
import {
  ClipboardDocumentListIcon,
  RectangleStackIcon,
  ChartPieIcon,
  MapIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

const baseItems = [
  { to: "/tasks", label: "Задачи", icon: ClipboardDocumentListIcon },
  { to: "/profile", label: "Профиль", icon: UserCircleIcon },
];

const adminItems = [
  { to: "/cp/kanban", label: "Канбан", icon: ClipboardDocumentListIcon },
  { to: "/cp/reports", label: "Отчёты", icon: ChartPieIcon },
  { to: "/cp/routes", label: "Маршруты", icon: MapIcon },
  { to: "/cp/settings", label: "Настройки", icon: Cog6ToothIcon },
  { to: "/cp/logs", label: "Логи", icon: Cog6ToothIcon },
  { to: "/cp/storage", label: "Файлы", icon: RectangleStackIcon },
];

const managerItems = [
  { to: "/mg/kanban", label: "Канбан", icon: ClipboardDocumentListIcon },
  { to: "/mg/reports", label: "Отчёты", icon: ChartPieIcon },
  { to: "/mg/routes", label: "Маршруты", icon: MapIcon },
];

export default function Sidebar() {
  const { open, toggle } = useSidebar();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const role = user?.role || "user";
  const items = React.useMemo(() => {
    if (role === "admin") return [...baseItems, ...adminItems];
    if (role === "manager") return [...baseItems, ...managerItems];
    return baseItems;
  }, [role]);
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-stroke bg-white p-4 shadow-lg transition-transform duration-200 ease-in-out dark:bg-slate-900",
        open ? "translate-x-0" : "-translate-x-full",
        "lg:shadow-none",
      )}
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between">
        <button
          onClick={toggle}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Закрыть меню"
          type="button"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
      <nav className="mt-4 space-y-1">
        {items.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            aria-label={i.label}
            className={cn(
              "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
              pathname === i.to && "bg-slate-100 font-semibold dark:bg-slate-800",
            )}
          >
            <i.icon className="h-5 w-5" />
            <span className="truncate">{i.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
