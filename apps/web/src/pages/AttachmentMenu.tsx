// Страница выбора задачи для Attachment Menu
// Модули: React, useToast, authFetch, shared
import React, { useEffect, useState } from "react";
import { useToast } from "../context/useToast";
import authFetch from "../utils/authFetch";
import type { Task } from "shared";

type MenuTask = Task & { task_number: string; createdAt: string };

export default function AttachmentMenu() {
  const [tasks, setTasks] = useState<MenuTask[]>([]);
  const { addToast } = useToast();

  useEffect(() => {
    authFetch("/api/v1/tasks?limit=10", { noRedirect: true })
      .then((r) => {
        if (r.status === 401) {
          addToast("Сессия истекла, войдите снова", "error");
          return [];
        }
        return r.ok ? r.json() : [];
      })
      .then((data) =>
        setTasks((Array.isArray(data) ? data : data.tasks || []) as MenuTask[]),
      );
  }, [addToast]);

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
