// Модальное окно задачи с a11y-атрибутами
// Модули: React
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

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
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-dialog-title"
      className="fixed inset-0 z-50"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative mx-auto mt-0 w-screen rounded-2xl bg-white shadow-xl md:mt-16">
        <div className="flex items-center justify-between gap-4 border-b px-4 py-3 md:px-6">
          <h2
            id="task-dialog-title"
            className="text-base font-semibold md:text-lg"
          >
            {title}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t('close')}
            className="hover:bg-gray-100"
          >
            <span aria-hidden>✕</span>
          </Button>
        </div>
        <div className="h-screen max-h-none overflow-y-auto px-4 py-4 md:px-6 md:py-6">
          {children}
        </div>
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t bg-white/90 px-4 py-3 backdrop-blur md:px-6">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button form="task-form" type="submit">
            {t('create')}
          </Button>
        </div>
      </div>
    </div>
  );
}
