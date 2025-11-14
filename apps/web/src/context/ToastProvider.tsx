// Провайдер уведомлений, управляет списком тостов
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ToastContext, type Toast, type ToastState } from './ToastContext';

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      const id = Date.now();
      setToasts((t) => [...t, { id, message, type }]);
      timeoutId.current = setTimeout(
        () => setToasts((t) => t.filter((toast) => toast.id !== id)),
        3000,
      );
    },
    [],
  );
  const removeToast = useCallback((id: number) => {
    setToasts((t) => t.filter((toast) => toast.id !== id));
  }, []);
  useEffect(
    () => () => {
      if (timeoutId.current) clearTimeout(timeoutId.current);
    },
    [],
  );
  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type } = (
        e as CustomEvent<{ message: string; type?: 'success' | 'error' }>
      ).detail;
      addToast(message, type);
    };
    window.addEventListener('toast', handler);
    return () => window.removeEventListener('toast', handler);
  }, [addToast]);
  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};
