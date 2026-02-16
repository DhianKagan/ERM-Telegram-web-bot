// Провайдер уведомлений, управляет списком тостов
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ToastContext, type Toast, type ToastState } from './ToastContext';

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutIds = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const nextToastId = useRef(0);
  const addToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      nextToastId.current += 1;
      const id = nextToastId.current;
      setToasts((t) => [...t, { id, message, type }]);
      const timeoutId = setTimeout(() => {
        timeoutIds.current.delete(id);
        setToasts((t) => t.filter((toast) => toast.id !== id));
      }, 3000);
      timeoutIds.current.set(id, timeoutId);
    },
    [],
  );
  const removeToast = useCallback((id: number) => {
    const timeoutId = timeoutIds.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutIds.current.delete(id);
    }
    setToasts((t) => t.filter((toast) => toast.id !== id));
  }, []);
  useEffect(
    () => () => {
      timeoutIds.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      timeoutIds.current.clear();
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
