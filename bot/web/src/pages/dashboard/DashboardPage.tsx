// Страница Dashboard с примерными метриками
import React from "react";
import ReactApexChart from "react-apexcharts";
import MetricCard from "../../components/MetricCard";
import {
  ClipboardDocumentListIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

interface Task {
  status: string;
  due_date?: string;
  createdAt: string;
}

function useTasks() {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  React.useEffect(() => {
    fetch("/tasks", {
      headers: { Authorization: localStorage.token ? `Bearer ${localStorage.token}` : "" },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then(setTasks)
      .catch(() => setTasks([]));
  }, []);
  return tasks;
}

function calcMetrics(tasks: Task[]) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 6);
  const chartMap = Array(7).fill(0);
  for (const t of tasks) {
    const d = new Date(t.createdAt);
    const diff = Math.floor((d.getTime() - start.getTime()) / 86400000);
    if (diff >= 0 && diff < 7) chartMap[diff]++;
  }
  const all = tasks.length;
  const inWork = tasks.filter((t) => t.status === "in-progress").length;
  const overdue = tasks.filter(
    (t) => t.due_date && new Date(t.due_date) < now && t.status !== "completed",
  ).length;
  const today = tasks.filter(
    (t) => t.due_date && new Date(t.due_date).toDateString() === now.toDateString(),
  ).length;
  return {
    metrics: [
      { title: "Всего задач", value: all, icon: ClipboardDocumentListIcon },
      { title: "В работе", value: inWork, icon: ArrowPathIcon },
      { title: "Просрочено", value: overdue, icon: ExclamationTriangleIcon },
      { title: "Задач сегодня", value: today, icon: CalendarDaysIcon },
    ],
    chart: {
      series: [{ name: "tasks", data: chartMap }],
      options: {
        chart: { height: 200, type: "line", toolbar: { show: false } },
        stroke: { width: 2, curve: "smooth" },
        xaxis: { categories: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].slice(-7) },
      },
    },
  };
}

export default function DashboardPage() {
  const tasks = useTasks();
  const { metrics, chart } = calcMetrics(tasks);
  return (
    <div className="space-y-6 p-4">
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      <p className="text-gray-500">Добро пожаловать в панель управления agrmcs.</p>
      <div className="grid gap-4 sm:grid-cols-4">
        {metrics.map((m) => (
          <MetricCard key={m.title} title={m.title} value={m.value} icon={m.icon} />
        ))}
      </div>
      <ReactApexChart {...chart} type="line" height={200} />
    </div>
  );
}
