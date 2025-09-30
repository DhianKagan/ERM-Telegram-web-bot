// Назначение: модалка подтверждения действий
// Основные модули: React, Modal
import React from "react";

import { Button } from "@/components/ui/button";
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
        <Button variant="outline" size="pill" onClick={onCancel}>
          {cancelText}
        </Button>
        <Button variant="destructive" size="pill" onClick={onConfirm}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
