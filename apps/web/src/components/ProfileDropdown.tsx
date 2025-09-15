// Назначение: выпадающее меню профиля пользователя.
// Основные модули: React, Radix Dropdown Menu, useAuth.
import React from "react";
import { Link } from "react-router-dom";
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

interface ProfileDropdownProps {
  children?: React.ReactNode;
}

export default function ProfileDropdown({
  children,
}: ProfileDropdownProps) {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  const name = user.name || user.telegram_username || user.username || "Профиль";
  const profileLink = `/employees/${user.id}`;

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
        <DropdownMenuItem asChild>
          <Link to={profileLink} className="truncate">
            {name}
          </Link>
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
