// Назначение файла: показ TaskDialog поверх текущей страницы
// Отображает TaskDialog при наличии query-параметров
import React, { Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import useTasks from "../context/useTasks";
import Modal from "./Modal";

const TaskDialogLazy = React.lazy(() => import("./TaskDialog"));

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
    <Modal open onClose={close}>
      <Suspense fallback={<div>Загрузка диалога...</div>}>
        <TaskDialogLazy
          id={id || undefined}
          onClose={close}
          onSave={() => {
            refresh();
          }}
        />
      </Suspense>
    </Modal>
  );
}
