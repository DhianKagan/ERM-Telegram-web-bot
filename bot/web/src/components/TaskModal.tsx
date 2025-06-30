// Подробное модальное окно задачи
import React from "react";
import RichTextEditor from "./RichTextEditor";
import { updateTask } from "../services/tasks";
import authFetch from "../utils/authFetch";

interface TaskModalProps {
  id: string
  onClose: () => void
}

interface User {
  telegram_id: number
  username: string
}

export default function TaskModal({ id, onClose }: TaskModalProps) {
  const [task, setTask] = React.useState<any>(null);
  const [users, setUsers] = React.useState<User[]>([]);
  const chatId = import.meta.env.VITE_CHAT_ID;

  React.useEffect(() => {
    authFetch(`/api/tasks/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setTask);
    authFetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers);
  }, [id]);

  const save = async () => {
    await updateTask(id, task);
    onClose();
  };

  if (!task) return null;

  const topicUrl = chatId && task.telegram_topic_id ?
    `https://t.me/c/${String(chatId).replace('-100', '')}/${task.telegram_topic_id}` : null;

  return (
    <div className="bg-opacity-30 animate-fade-in fixed inset-0 flex items-center justify-center bg-black">
      <div className="max-h-screen w-full max-w-lg space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold">🔧 Задача №{task._id}</h3>
        {topicUrl && (
          <a href={topicUrl} target="_blank" rel="noopener" className="text-accentPrimary text-sm underline">
            Обсудить в Telegram
          </a>
        )}
        <div>
          <label className="block text-sm font-medium">
            📍 Адрес / Локация
          </label>
          <input
            value={task.location || ""}
            onChange={(e) => setTask({ ...task, location: e.target.value })}
            className="mt-1 w-full rounded border px-2 py-1"
          />
          {task.location && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(task.location)}`}
              target="_blank"
              rel="noopener"
              className="text-accentPrimary text-xs underline"
            >
              Открыть на карте
            </a>
          )}
        </div>
        <div className="text-sm">
          📅 Дата создания: {new Date(task.createdAt).toLocaleString()}
        </div>
        <div>
          <label className="block text-sm font-medium">
            📅 Срок выполнения
          </label>
          <input
            type="datetime-local"
            value={
              task.due_date
                ? new Date(task.due_date).toISOString().slice(0, 16)
                : ""
            }
            onChange={(e) => setTask({ ...task, due_date: e.target.value })}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">🔨 Задача</label>
          <RichTextEditor
            value={task.task_description}
            onChange={(v) => setTask({ ...task, task_description: v })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">📌 Статус</label>
          <select
            value={task.status}
            onChange={(e) => setTask({ ...task, status: e.target.value })}
            className="mt-1 w-full rounded border px-2 py-1"
          >
            <option value="new">🟪 Не начато</option>
            <option value="in-progress">⏳ В процессе</option>
            <option value="done">✅ Готово</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">👷 Ответственный</label>
          <select
            value={task.assigned_user_id || ""}
            onChange={(e) =>
              setTask({ ...task, assigned_user_id: e.target.value })
            }
            className="mt-1 w-full rounded border px-2 py-1"
            id="assignee-select"
          >
            <option value="">назначить</option>
            {users.map((u) => (
              <option key={u.telegram_id} value={u.telegram_id}>
                {u.username}
              </option>
            ))}
          </select>
          {task.assigned_user_id && (
            <a
              href={`tg://user?id=${task.assigned_user_id}`}
              className="text-accentPrimary text-sm underline"
            >
              {users.find((u) => u.telegram_id === task.assigned_user_id)?.username ||
                task.assigned_user_id}
            </a>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium">🧾 Контролёр</label>
          <select
            value={task.controller_user_id || ""}
            onChange={(e) =>
              setTask({ ...task, controller_user_id: e.target.value })
            }
            className="mt-1 w-full rounded border px-2 py-1"
            id="controller-select"
          >
            <option value="">назначить</option>
            {users.map((u) => (
              <option key={u.telegram_id} value={u.telegram_id}>
                {u.username}
              </option>
            ))}
          </select>
          {task.controller_user_id && (
            <a
              href={`tg://user?id=${task.controller_user_id}`}
              className="text-accentPrimary text-sm underline"
            >
              {users.find((u) => u.telegram_id === task.controller_user_id)?.username ||
                task.controller_user_id}
            </a>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium">📝 Комментарий</label>
          <RichTextEditor
            value={task.comment}
            onChange={(v) => setTask({ ...task, comment: v })}
          />
        </div>
        {task.attachments?.length > 0 && (
          <div>
            <label className="block text-sm font-medium">📎 Вложения</label>
            <ul className="list-disc pl-4">
              {task.attachments.map((a) => (
                <li key={a.url}>
                  <a href={a.url} target="_blank" rel="noopener" className="text-accentPrimary underline">
                    {a.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium">
            📝 Прикрепить файл
          </label>
          <input
            type="file"
            multiple
            className="mt-1 w-full"
            onChange={(e) =>
              setTask({
                ...task,
                files: Array.from(e.target.files).map((f) => f.name),
              })
            }
          />
        </div>
        <div className="flex justify-end space-x-2">
          <button className="btn-gray" onClick={onClose}>
            Закрыть
          </button>
          <button className="btn-blue" onClick={save}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
