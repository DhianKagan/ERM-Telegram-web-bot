// Боковое меню с навигацией по разделам
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useSidebar } from "../context/SidebarContext";
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const items = [

  { to: "/dashboard", label: "Dashboard" },
  { to: "/tasks", label: "Задачи" },
  { to: "/logs", label: "Логи" },
  { to: "/roles", label: "Роли" },
  { to: "/charts", label: "Charts" },

];

export default function Sidebar() {
  const { open, toggle } = useSidebar();
  const { pathname } = useLocation();
  return (
    <aside
      className={`fixed z-20 h-full w-52 border-r bg-white p-4 transition-transform dark:border-gray-800 dark:bg-gray-900 ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
    >
      <button onClick={toggle} className="mb-4 md:hidden">
        <XMarkIcon className="h-5 w-5" />
      </button>
      <nav className="space-y-2">
        {items.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            className={`flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 ${pathname === i.to ? "font-semibold" : ""}`}
          >
            <i.icon className="h-5 w-5" />
            {i.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
