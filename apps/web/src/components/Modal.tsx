// Назначение: универсальная модалка с порталом в document.body
// Основные модули: React, ReactDOM
import React from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, children }: ModalProps) {
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="pointer-events-auto max-h-[90vh] w-[min(900px,90vw)] overflow-auto rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть диалог"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
