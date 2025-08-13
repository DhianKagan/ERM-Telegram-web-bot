// Назначение файла: показ TaskDialog поверх текущей страницы
// Отображает TaskDialog при наличии query-параметров
import React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import TaskDialog from "./TaskDialog";
import useTasks from "../context/useTasks";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export default function TaskDialogRoute() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useTasks();
  const id = params.get("task");
  const create = params.get("newTask");
  if (!id && !create) return null;
  const close = () => {
    params.delete("task");
    params.delete("newTask");
    navigate({ search: params.toString() }, { replace: true });
  };
  return (
    <Dialog open onOpenChange={close}>
      <DialogContent className="p-0" aria-describedby={undefined}>
        <DialogHeader>
          <VisuallyHidden asChild>
            <DialogTitle>Форма задачи</DialogTitle>
          </VisuallyHidden>
        </DialogHeader>
        <TaskDialog
          id={id || undefined}
          onClose={close}
          onSave={() => {
            refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
