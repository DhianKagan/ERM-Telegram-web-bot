// Страница Dashboard с примерными метриками
import React from "react";

const metrics = [
  { title: 'Всего задач', value: 0 },
  { title: 'Выполнено', value: 0 },
  { title: 'Открыто', value: 0 },
];

export default function DashboardPage() {
  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-semibold">Dashboard</h2>
      <p>Добро пожаловать в панель управления agrmcs.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {metrics.map((m) => (
          <div
            key={m.title}
            className="rounded border bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
          >
            <p className="text-sm text-gray-500">{m.title}</p>
            <p className="text-2xl font-bold">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
