// Страница Dashboard с примерными метриками
import React from "react";
import ReactApexChart from "react-apexcharts";

const metrics = [
  { title: "Всего задач", value: 0 },
  { title: "В работе", value: 0 },
  { title: "Просрочено", value: 0 },
  { title: "Задач сегодня", value: 0 },
];

const chart = {
  series: [{ name: "tasks", data: [0, 3, 2, 4, 3, 5] }],
  options: {
    chart: { height: 200, type: "line", toolbar: { show: false } },
    stroke: { width: 2, curve: "smooth" },
    xaxis: { categories: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] },
  },
};

export default function DashboardPage() {
  return (
    <div className="space-y-6 p-4">
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      <p className="text-gray-500">Добро пожаловать в панель управления agrmcs.</p>
      <div className="grid gap-4 sm:grid-cols-4">
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
      <ReactApexChart {...chart} type="line" height={200} />
    </div>
  );
}
