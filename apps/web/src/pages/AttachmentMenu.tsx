// Страница выбора задачи для Attachment Menu
import React, { useEffect, useState } from "react";
import authFetch from "../utils/authFetch";
import type { Task } from "shared";

type MenuTask = Task & { task_number: string; createdAt: string };

export default function AttachmentMenu() {
  const [tasks, setTasks] = useState<MenuTask[]>([]);

  useEffect(() => {
    authFetch("/api/v1/tasks?limit=10")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) =>
        setTasks((Array.isArray(data) ? data : data.tasks || []) as MenuTask[]),
      );
  }, []);

  function select(id: string) {
    if (window.Telegram?.WebApp?.sendData) {
      window.Telegram.WebApp.sendData(`task_selected:${id}`);
    }
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-lg">Выберите задачу</h1>
      <ul>
        {tasks.map((t) => (
          <li key={t._id} className="mb-2">
            <button
              onClick={() => select(t._id)}
              className="text-blue-600 underline"
            >
              {`${t.task_number} ${t.createdAt.slice(0, 10)} ${t.title}`}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
