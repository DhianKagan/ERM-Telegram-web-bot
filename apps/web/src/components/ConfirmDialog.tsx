// Назначение: модалка подтверждения действий
// Основные модули: React, Modal
import React from 'react';

import { Button } from '@/components/ui/button';
import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  message: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: React.ComponentProps<typeof Button>['variant'];
}

export default function ConfirmDialog({
  open,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  confirmVariant = 'destructive',
}: ConfirmDialogProps) {
  const [pending, setPending] = React.useState(false);

  const handleConfirm = React.useCallback(() => {
    if (pending) return;
    try {
      const result = onConfirm();
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        setPending(true);
        (result as Promise<unknown>)
          .catch((error) => {
            console.error(error);
          })
          .finally(() => setPending(false));
      }
    } catch (error) {
      setPending(false);
      console.error(error);
    }
  }, [onConfirm, pending]);

  return (
    <Modal open={open} onClose={onCancel}>
      <p>{message}</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="outline"
          size="pill"
          onClick={onCancel}
          disabled={pending}
        >
          {cancelText}
        </Button>
        <Button
          variant={confirmVariant}
          size="pill"
          onClick={handleConfirm}
          disabled={pending}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
