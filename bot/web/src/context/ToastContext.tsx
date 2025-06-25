// Контекст всплывающих уведомлений
import React, { createContext, useContext, useState } from "react";
import NotificationBar from "../components/NotificationBar";

export type Toast = { id: number; message: string; type?: "success" | "error" };
export interface ToastState {
  addToast: (message: string, type?: "success" | "error") => void;
}

const ToastContext = createContext<ToastState | undefined>(undefined);
let counter = 0;

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("ToastContext");
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = counter++;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((i) => i.id !== id)), 3000);
  };
  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <NotificationBar key={t.id} message={t.message} type={t.type} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
