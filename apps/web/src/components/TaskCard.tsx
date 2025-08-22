// Карточка задачи в канбане
import React from "react";

interface Task {
  title: string;
  dueDate?: string;
}

interface TaskCardProps {
  task: Task;
}

export default function TaskCard({ task }: TaskCardProps) {
  return (
    <div className="mb-2 rounded bg-white p-3 shadow">
      <h4 className="font-semibold">{task.title}</h4>
      <p className="text-xs text-gray-500">{task.dueDate?.slice(0, 10)}</p>
    </div>
  );
}
