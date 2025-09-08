// Назначение: модалка подтверждения действий
// Основные модули: React, Modal
import React from "react";
import Modal from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function ConfirmDialog({
  open,
  message,
  onConfirm,
  onCancel,
  confirmText = "Подтвердить",
  cancelText = "Отмена",
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel}>
      <p>{message}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-gray rounded-full" onClick={onCancel}>
          {cancelText}
        </button>
        <button className="btn-red rounded-full" onClick={onConfirm}>
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
