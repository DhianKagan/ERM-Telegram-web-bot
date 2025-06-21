/**
 * Назначение: страница списка задач с формой добавления.
 * Основные модули: React, Next.js, Tailwind.
 */
"use client";

import { useEffect, useState } from "react";
import SectionMain from "../../_components/Section/Main";
import SectionTitleLineWithButton from "../../_components/Section/TitleLineWithButton";
import { mdiTable } from "@mdi/js";
import { getTasks, createTask } from "../../_lib/api";
import NotificationBar from "../../_components/NotificationBar";

type Task = { _id: string; task_description: string; status: string };

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [description, setDescription] = useState('')
  const [notification, setNotification] = useState('')

  useEffect(() => {
    getTasks().then(setTasks).catch(console.error)
  }, [])

  const addTask = async () => {
    if (!description) return
    const t = await createTask(description)
    setTasks([...tasks, t])
    setDescription('')
    setNotification('Задача добавлена')
    setTimeout(() => setNotification(''), 3000)
  }

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiTable} title="Tasks" main />
      {notification && (
        <NotificationBar color="success" icon={mdiTable} key={notification}>
          {notification}
        </NotificationBar>
      )}
      <div className="flex mb-4 space-x-2">
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="border p-2 flex-1 rounded"
          placeholder="New task"
        />
        <button
          onClick={addTask}
          className="bg-blue-500 text-white px-4 rounded"
        >
          Add
        </button>
      </div>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t._id} className="border p-2 rounded">
            {t.task_description} – {t.status}
          </li>
        ))}
      </ul>
    </SectionMain>
  );
}
