// Список задач для выбранного диапазона дат
import React from "react";

interface Task {
  _id: string;
  title: string;
  request_id: string;
  createdAt: string;
}

export default function TaskRangeList({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) {
    return <p className="text-sm text-gray-500">Нет задач</p>;
  }
  return (
    <ul className="space-y-1 text-sm">
      {tasks.map((t) => {
        const name = t.title.replace(/^ERM_\d+\s*/, "");
        const date = t.createdAt?.slice(0, 10);
        return (
          <li key={t._id} className="border-b pb-1 last:border-b-0">
            {`${t.request_id} ${date} ${name}`}
          </li>
        );
      })}
    </ul>
  );
}
