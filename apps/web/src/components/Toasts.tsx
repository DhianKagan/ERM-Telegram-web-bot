// Назначение: показ всплывающих уведомлений, модули: React, Context
import React from "react";
import { useToast } from "../context/useToast";
import NotificationBar from "./NotificationBar";

export default function Toasts() {
  const { toasts, removeToast } = useToast();
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((t) => (
        <NotificationBar
          key={t.id}
          message={t.message}
          type={t.type}
          onClose={() => removeToast(t.id)}
        />
      ))}
    </div>
  );
}
