// Боковое меню с навигацией по разделам
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSidebar } from "../context/useSidebar";
import { useAuth } from "../context/useAuth";
import {
  ClipboardDocumentListIcon,
  InboxArrowDownIcon,
  ChartPieIcon,
  MapIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { ARCHIVE_ACCESS, hasAccess } from "../utils/access";

type SidebarItem = {
  to: string;
  label: string;
  icon: React.ComponentType<React.ComponentProps<"svg">>;
};

export default function Sidebar() {
  const { open, toggle } = useSidebar();
  const { pathname, search } = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();
  const role = user?.role || "user";
  const access = typeof user?.access === "number" ? user.access : 0;
  const allowArchive =
    role === "admin" && hasAccess(access, ARCHIVE_ACCESS);

  const baseItems = React.useMemo<SidebarItem[]>(
    () => [
      { to: "/tasks", label: t("nav.tasks"), icon: ClipboardDocumentListIcon },
      {
        to: "/requests",
        label: t("nav.requests"),
        icon: InboxArrowDownIcon,
      },
      { to: "/profile", label: t("nav.profile"), icon: UserCircleIcon },
    ],
    [t],
  );

  const adminItems = React.useMemo<SidebarItem[]>(
    () => [
      { to: "/cp/kanban", label: t("nav.kanban"), icon: ClipboardDocumentListIcon },
      { to: "/cp/logistics", label: t("nav.logistics"), icon: MapIcon },
      { to: "/cp/settings", label: t("nav.settings"), icon: Cog6ToothIcon },
    ],
    [t],
  );

  const managerItems = React.useMemo<SidebarItem[]>(
    () => [
      { to: "/mg/kanban", label: t("nav.kanban"), icon: ClipboardDocumentListIcon },
      { to: "/mg/reports", label: t("nav.reports"), icon: ChartPieIcon },
      { to: "/mg/logistics", label: t("nav.logistics"), icon: MapIcon },
    ],
    [t],
  );

  const currentSearchParams = React.useMemo(
    () => new URLSearchParams(search),
    [search],
  );

  const items = React.useMemo(() => {
    if (role === "admin") {
      const [kanbanItem, logisticsItem, settingsItem] = adminItems;
      const settingsLink = allowArchive
        ? { ...settingsItem, to: "/cp/settings?module=archive" }
        : settingsItem;
      return [...baseItems, kanbanItem, logisticsItem, settingsLink];
    }
    if (role === "manager") return [...baseItems, ...managerItems];
    return baseItems;
  }, [role, allowArchive, adminItems, baseItems, managerItems]);

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
        {items.map((i) => {
          const [itemPath, itemQuery] = i.to.split("?");
          const matchesPath = pathname === itemPath;
          const isActive = (() => {
            if (!itemQuery) return matchesPath;
            if (!matchesPath) return false;
            const required = new URLSearchParams(itemQuery);
            return Array.from(required.entries()).every(
              ([key, value]) => currentSearchParams.get(key) === value,
            );
          })();
          return (
            <Link
              key={i.to}
              to={i.to}
              aria-label={i.label}
              className={cn(
                "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                isActive && "bg-slate-100 font-semibold dark:bg-slate-800",
              )}
            >
              <i.icon className="h-5 w-5" />
              <span className="truncate">{i.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
