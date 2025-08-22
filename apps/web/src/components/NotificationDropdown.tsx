// Выпадающий список уведомлений
import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
        <Button variant="ghost" size="icon" aria-label={t("notifications")}>
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
