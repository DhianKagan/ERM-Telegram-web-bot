// Назначение: канбан-доска задач с перетаскиванием
// Основные модули: React, @hello-pangea/dnd (ленивый импорт), сервис задач
import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import TaskCard from "./components/TaskCard";
import TaskDialog from "./components/TaskDialog";
import { fetchKanban, updateTaskStatus } from "./services/tasks";

const columns = ["Новая", "В работе", "Выполнена"];

interface KanbanTask {
  _id: string;
  status: string;
  title: string;
}

export default function TaskBoard() {
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [params, setParams] = useSearchParams();
  const open = params.get("newTask") !== null;
  const [dnd, setDnd] = useState<any>(null);

  useEffect(() => {
    import("@hello-pangea/dnd").then(setDnd);
  }, []);

  useEffect(() => {
    fetchKanban().then(setTasks);
  }, []);

  const onDragEnd = async ({ destination, draggableId }) => {
    if (!destination) return;
    const status = columns[Number(destination.droppableId)];
    await updateTaskStatus(draggableId, status);
    setTasks((ts) =>
      ts.map((t) => (t._id === draggableId ? { ...t, status } : t)),
    );
  };

  if (!dnd) return <div className="p-4">Загрузка...</div>;
  const { DragDropContext, Droppable, Draggable } = dnd;

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-col gap-2 md:flex-row">
        <Link to="/tasks" className="btn-gray">
          Таблица
        </Link>
        <button
          onClick={() => {
            params.set("newTask", "1");
            setParams(params);
          }}
          className="btn-blue"
        >
          Новая задача
        </button>
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
                            <TaskCard task={t} />
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
            params.delete("newTask");
            setParams(params);
          }}
          onSave={() => {
            fetchKanban().then(setTasks);
          }}
        />
      )}
    </div>
  );
}
