// Контекст уведомлений тостов
import { createContext } from 'react';

export interface Toast {
  id: number;
  message: string;
  type?: 'success' | 'error';
}

export interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: 'success' | 'error') => void;
  removeToast: (id: number) => void;
}

export const ToastContext = createContext<ToastState | undefined>(undefined);

// Экспорт провайдера из соседнего файла
export { ToastProvider } from './ToastProvider';
