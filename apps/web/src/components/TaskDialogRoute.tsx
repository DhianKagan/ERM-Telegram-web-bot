// Назначение файла: показ TaskDialog поверх текущей страницы
// Основные модули: React, react-router-dom, useTasks, coerceTaskId
import React, { Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import useTasks from "../context/useTasks";
import coerceTaskId from "../utils/coerceTaskId";

const TaskDialogLazy = React.lazy(() => import("./TaskDialog"));

export default function TaskDialogRoute() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh, controller } = useTasks();
  const id = coerceTaskId(params.get("task"));
  const create = params.get("newTask");
  const createRequest = params.get("newRequest");
  if (!id && !create && !createRequest) return null;
  const close = () => {
    params.delete("task");
    params.delete("newTask");
    params.delete("newRequest");
    navigate({ search: params.toString() }, { replace: true });
  };
  return (
    <Suspense fallback={null}>
      <TaskDialogLazy
        id={id || undefined}
        onClose={close}
        onSave={(data) => {
          if (data) controller.upsert(data);
          else if (id) controller.remove(id);
          refresh();
        }}
        kind={createRequest ? "request" : undefined}
      />
    </Suspense>
  );
}
