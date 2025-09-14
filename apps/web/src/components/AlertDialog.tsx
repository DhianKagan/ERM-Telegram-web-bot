// Назначение: модальное окно предупреждения
// Основные модули: React, Modal
import React from "react";
import Modal from "./Modal";

interface AlertDialogProps {
  open: boolean;
  message: string;
  onClose: () => void;
  closeText?: string;
}

export default function AlertDialog({
  open,
  message,
  onClose,
  closeText = "Закрыть",
}: AlertDialogProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <p>{message}</p>
      <div className="mt-4 flex justify-end">
        <button className="btn-blue rounded-full" onClick={onClose}>
          {closeText}
        </button>
      </div>
    </Modal>
  );
}
