// Список задач для выбранного диапазона дат
import React from "react";
import type { Task } from "shared";

type RangeTask = Task & { task_number: string; createdAt: string };

export default function TaskRangeList({ tasks }: { tasks: RangeTask[] }) {
  if (!tasks.length) {
    return <p className="text-sm text-gray-500">Нет задач</p>;
  }
  return (
    <ul className="space-y-1 text-sm">
      {tasks.map((t) => {
        const date = t.createdAt?.slice(0, 10);
        return (
          <li key={t._id} className="border-b pb-1 last:border-b-0">
            {`${t.task_number} ${date} ${t.title}`}
          </li>
        );
      })}
    </ul>
  );
}
