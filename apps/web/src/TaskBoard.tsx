// Назначение: канбан-доска задач с перетаскиванием
// Основные модули: React, @hello-pangea/dnd, сервис задач
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import TaskCard from "./components/TaskCard";
import TaskDialog from "./components/TaskDialog";
import useTasks from "./context/useTasks";
import { fetchKanban, updateTaskStatus } from "./services/tasks";
import type { Task } from "shared";

const columns = ["Новая", "В работе", "Выполнена"];

type KanbanTask = Task & {
  dueDate?: string;
  due_date?: string;
  due?: string;
  request_id?: string;
  task_number?: string;
};

export default function TaskBoard() {
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [params, setParams] = useSearchParams();
  const open = params.get("newTask") !== null;
  const { version } = useTasks();

  useEffect(() => {
    let active = true;
    fetchKanban()
      .then((list) => {
        if (active) setTasks(list);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [version]);

  const onDragEnd = async ({ destination, draggableId }) => {
    if (!destination) return;
    const status = columns[Number(destination.droppableId)];
    await updateTaskStatus(draggableId, status);
    setTasks((ts) =>
      ts.map((t) => (t._id === draggableId ? { ...t, status } : t)),
    );
  };

  const openTaskDialog = useCallback(
    (taskId: string) => {
      const trimmed = String(taskId || "").trim();
      if (!trimmed) return;
      const next = new URLSearchParams(params);
      next.set("task", trimmed);
      next.delete("newTask");
      setParams(next);
    },
    [params, setParams],
  );

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-col gap-2 md:flex-row">
        <Link
          to="/tasks"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Таблица
        </Link>
        <Button
          onClick={() => {
            const next = new URLSearchParams(params);
            next.set("newTask", "1");
            next.delete("task");
            setParams(next);
          }}
        >
          Новая задача
        </Button>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex space-x-4 overflow-x-auto">
          {columns.map((key, idx) => (
            <Droppable droppableId={String(idx)} key={key}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="w-64 rounded bg-gray-100 p-2"
                >
                  <h3 className="mb-2 font-bold">{key.replace("_", " ")}</h3>
                  {tasks
                    .filter((t) => t.status === key)
                    .map((t, i) => (
                      <Draggable key={t._id} draggableId={t._id} index={i}>
                        {(prov) => (
                      <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        {...prov.dragHandleProps}
                      >
                        <TaskCard task={t} onOpen={openTaskDialog} />
                      </div>
                    )}
                  </Draggable>
                ))}
              {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
      {open && (
        <TaskDialog
          onClose={() => {
            const next = new URLSearchParams(params);
            next.delete("newTask");
            setParams(next);
          }}
          onSave={() => {
            fetchKanban().then(setTasks);
          }}
        />
      )}
    </div>
  );
}
