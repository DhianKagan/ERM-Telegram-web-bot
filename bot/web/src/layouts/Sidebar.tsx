// Боковое меню с навигацией по разделам
import React from "react";
import { Link } from "react-router-dom";
import { useSidebar } from "../context/SidebarContext";

const items = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/tasks", label: "Задачи" },
  { to: "/logs", label: "Логи" },
  { to: "/roles", label: "Роли" },
  { to: "/charts", label: "Charts" },
];

export default function Sidebar() {
  const { open, toggle } = useSidebar();
  return (
    <aside
      className={`fixed h-full border-r border-gray-200 bg-white p-4 transition-transform dark:border-gray-800 dark:bg-gray-900 ${open ? "translate-x-0" : "-translate-x-full"} w-52 md:translate-x-0`}
    >
      <button onClick={toggle} className="mb-4 md:hidden">
        ☰
      </button>
      <nav className="space-y-2">
        {items.map((i) => (
          <Link key={i.to} to={i.to} className="block hover:underline">
            {i.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
