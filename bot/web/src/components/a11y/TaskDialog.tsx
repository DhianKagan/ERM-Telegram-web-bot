// Модальное окно задачи с a11y-атрибутами
// Модули: React
import React from "react";

type TaskDialogProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
};

export function TaskDialog({
  open,
  onClose,
  children,
  title,
}: TaskDialogProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-dialog-title"
      className="fixed inset-0 z-50"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative mx-auto mt-8 w-[min(100vw-1rem,56rem)] rounded-2xl bg-white shadow-xl md:mt-16">
        <div className="flex items-center justify-between gap-4 border-b px-4 py-3 md:px-6">
          <h2
            id="task-dialog-title"
            className="text-base font-semibold md:text-lg"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto px-4 py-4 md:px-6 md:py-6">
          {children}
        </div>
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t bg-white/90 px-4 py-3 backdrop-blur md:px-6">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Отмена
          </button>
          <button form="task-form" type="submit" className="btn btn-primary">
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}
