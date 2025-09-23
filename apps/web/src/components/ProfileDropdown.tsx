// Назначение: выпадающее меню профиля пользователя.
// Основные модули: React, Radix Dropdown Menu, useAuth, useEmployeeDialog.
import React from "react";
import { UserCircleIcon } from "@heroicons/react/24/outline";

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
}

export default function ProfileDropdown({
  children,
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
          size="icon"
          aria-label="Профиль"
          className="size-12"
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
