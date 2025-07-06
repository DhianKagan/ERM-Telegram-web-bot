
import React, { useState, useCallback } from "react";
import { ToastContext, type Toast, type ToastState } from "./ToastContext";

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

