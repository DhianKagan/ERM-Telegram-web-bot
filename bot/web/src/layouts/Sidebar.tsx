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
} from "@heroicons/react/24/outline";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: HomeIcon },
  { to: "/tasks", label: "Задачи", icon: ClipboardDocumentListIcon },
  { to: "/tasks/kanban", label: "Канбан", icon: ClipboardDocumentListIcon },
  { to: "/projects", label: "Проекты", icon: RectangleStackIcon },
  { to: "/reports", label: "Отчёты", icon: ChartPieIcon },
  { to: "/admin", label: "Админ", icon: Cog6ToothIcon },
  { to: "/profile", label: "Профиль", icon: UserCircleIcon },
];

export default function Sidebar() {
  const { open, toggle } = useSidebar();
  const { pathname } = useLocation();
  return (
    <aside
      className={`fixed z-20 h-full w-60 border-r border-gray-200 bg-white p-4 transition-transform dark:border-gray-800 dark:bg-gray-900 ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
    >
      <button onClick={toggle} className="mb-4 md:hidden">
        <XMarkIcon className="h-5 w-5" />
      </button>
      <nav className="mt-4 space-y-2">
        {items.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            className={`flex items-center gap-2 rounded-lg px-2 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 ${pathname === i.to ? "bg-gray-100 dark:bg-gray-800 font-semibold" : ""}`}
          >
            <i.icon className="h-5 w-5" />
            {i.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
