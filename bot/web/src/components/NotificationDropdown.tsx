// Выпадающий список уведомлений
import React from "react";
import { useTranslation } from "react-i18next";

export default function NotificationDropdown({
  notifications,
  children,
}: {
  notifications: string[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const { t } = useTranslation();
  return (
    <div className="relative" onBlur={() => setOpen(false)} tabIndex={0}>
      <button
        onClick={() => setOpen(!open)}
        className="hover:text-accentPrimary p-2"
        aria-label={t("notifications")}
      >
        {children}
      </button>
      {open && (
        <ul className="border-stroke absolute right-0 mt-2 w-60 rounded border bg-white py-2 shadow-lg transition-all">
          {notifications.length ? (
            notifications.map((n, i) => (
              <li key={i} className="text-body hover:bg-gray px-4 py-2 text-sm">
                {n}
              </li>
            ))
          ) : (
            <li className="text-bodydark px-4 py-2 text-sm">
              {t("noNotifications")}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
