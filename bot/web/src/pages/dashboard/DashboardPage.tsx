// Страница Dashboard с примерными метриками
import React from "react";

const metrics = [
  { title: 'Всего задач', value: 0 },
  { title: 'Выполнено', value: 0 },
  { title: 'Открыто', value: 0 },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6 p-4">
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      <p className="text-gray-500">Добро пожаловать в панель управления agrmcs.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {metrics.map((m) => (
          <div
            key={m.title}
            className="rounded-lg border border-gray-200 bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800"
          >
            <p className="text-sm text-gray-500">{m.title}</p>
            <p className="text-2xl font-bold text-brand-500">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
