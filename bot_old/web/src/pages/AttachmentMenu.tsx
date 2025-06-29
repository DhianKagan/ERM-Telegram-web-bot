// Страница выбора задачи для Attachment Menu
import React, { useEffect, useState } from 'react';
import authFetch from '../utils/authFetch';

interface Task {
  _id: string;
  title: string;
}

export default function AttachmentMenu() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    authFetch('/api/tasks?limit=10')
      .then(r => (r.ok ? r.json() : []))
      .then(setTasks);
  }, []);

  function select(id: string) {
    if (window.Telegram?.WebApp?.sendData) {
      window.Telegram.WebApp.sendData(`task_selected:${id}`);
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-lg mb-4">Выберите задачу</h1>
      <ul>
        {tasks.map(t => (
          <li key={t._id} className="mb-2">
            <button onClick={() => select(t._id)} className="text-blue-600 underline">
              {t.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
