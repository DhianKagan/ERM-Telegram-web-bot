// Страница выбора задачи для Attachment Menu
// Модули: React, useToast, authFetch, shared
import React, { useEffect, useState } from "react";
import type { Task } from "shared";

import { Button } from "@/components/ui/button";
import { useToast } from "../context/useToast";
import authFetch from "../utils/authFetch";

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
    type TelegramApi = {
      WebApp?: {
        sendData?: (data: string) => void;
      };
    };
    const telegram = (globalThis as typeof globalThis & { Telegram?: TelegramApi }).Telegram;
    telegram?.WebApp?.sendData?.(`task_selected:${id}`);
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-lg">Выберите задачу</h1>
      <ul>
        {tasks.map((t) => (
          <li key={t._id} className="mb-2">
            <Button
              onClick={() => select(t._id)}
              variant="link"
              size="sm"
              className="px-0"
            >
              {`${t.task_number} ${t.createdAt.slice(0, 10)} ${t.title}`}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
