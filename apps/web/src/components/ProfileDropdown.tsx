// Назначение: выпадающее меню профиля пользователя.
// Основные модули: React, Radix Dropdown Menu, useAuth, useEmployeeDialog.
import React from "react";
import { UserCircleIcon } from "@heroicons/react/24/outline";

import { cn } from "@/lib/utils";
import { useAuth } from "../context/useAuth";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import useEmployeeDialog from "../hooks/useEmployeeDialog";

interface ProfileDropdownProps {
  children?: React.ReactNode;
  triggerClassName?: string;
}

export default function ProfileDropdown({
  children,
  triggerClassName,
}: ProfileDropdownProps) {
  const { user, logout } = useAuth();
  const { open } = useEmployeeDialog();

  if (!user) {
    return null;
  }

  const name = user.name || user.telegram_username || user.username || "Профиль";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Профиль"
          className={cn(
            "h-auto rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-white focus-visible:ring-2 focus-visible:ring-primary/60 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-800",
            triggerClassName,
          )}
        >
          {children ?? <UserCircleIcon className="h-5 w-5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem
          onSelect={() => {
            if (user.id) {
              open(user.id);
            }
          }}
          className="cursor-pointer"
        >
          <span className="truncate text-accentPrimary">{name}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void logout();
          }}
        >
          Выход
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
