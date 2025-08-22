// Назначение: универсальная модалка с порталом в document.body
// Основные модули: React, ReactDOM
import React from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, children }: ModalProps) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="pointer-events-auto max-h-[90vh] w-[min(900px,90vw)] overflow-auto rounded-2xl bg-white p-6 shadow-xl">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
