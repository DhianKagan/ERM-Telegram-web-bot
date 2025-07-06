// Канбан-доска задач
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import TaskCard from "../components/TaskCard";
import TaskDialog from "../components/TaskDialog";
import { fetchKanban, updateTaskStatus } from "../services/tasks";

const columns = ["new", "in-progress", "done"];

interface KanbanTask {
  _id: string
  status: string
  title: string
}

export default function TaskKanban() {
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [params, setParams] = useSearchParams();

  const open = params.get('newTask') !== null;
  useEffect(() => {
    fetchKanban().then(setTasks);
  }, []);

  const onDragEnd = async ({ destination, draggableId }) => {
    if (!destination) return;
    const status = columns[destination.droppableId];
    await updateTaskStatus(draggableId, status);
    setTasks((ts) =>
      ts.map((t) => (t._id === draggableId ? { ...t, status } : t)),
    );
  };

  return (
    <div className="flex space-x-4 p-4">
      <button
        onClick={() => {
          params.set('newTask', '1')
          setParams(params)
        }}
        className="btn-blue mb-4"
      >
        Новая задача
      </button>
      <DragDropContext onDragEnd={onDragEnd}>
        {columns.map((key, idx) => (
          <Droppable droppableId={String(idx)} key={key}>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="w-64 rounded bg-gray-100 p-2"
              >
                <h3 className="mb-2 font-bold">
                  {key.replace("_", " ").toUpperCase()}
                </h3>
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
      </DragDropContext>
      {open && (
        <TaskDialog
          onClose={() => {
            params.delete('newTask')
            setParams(params)
          }}
          onSave={() => {
            params.delete('newTask')
            setParams(params)
            fetchKanban().then(setTasks)
          }}
        />
      )}
    </div>
  );
}
