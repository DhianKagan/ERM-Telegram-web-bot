// Назначение: выпадающий список уведомлений.
// Основные модули: React, react-i18next, shadcn/ui.
import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export default function NotificationDropdown({
  notifications,
  children,
}: {
  notifications: string[];
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("notifications")}
          className="size-12"
        >
          {children}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {notifications.length ? (
          notifications.map((n, i) => (
            <DropdownMenuItem key={i}>{n}</DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled>{t("noNotifications")}</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
