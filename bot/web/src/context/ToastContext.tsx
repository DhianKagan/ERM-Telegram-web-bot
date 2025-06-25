import React, { createContext, useContext, useState, useCallback } from "react";

export interface Toast {
  id: number;
  message: string;
  type?: "success" | "error";
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: "success" | "error") => void;
  removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastState | undefined>(undefined);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("ToastContext");
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      const id = Date.now();
      setToasts((t) => [...t, { id, message, type }]);
      setTimeout(
        () => setToasts((t) => t.filter((toast) => toast.id !== id)),
        3000,
      );
    },
    [],
  );
  const removeToast = useCallback((id: number) => {
    setToasts((t) => t.filter((toast) => toast.id !== id));
  }, []);
  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};
