// Страница списка задач
import React from "react";
import NotificationBar from "../components/NotificationBar";

interface Task {
  _id: string;
  task_description: string;
}

export default function Tasks() {
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [text, setText] = React.useState("")
  const [msg, setMsg] = React.useState("")

  React.useEffect(() => {
    fetch("/tasks", { headers: { Authorization: localStorage.token ? `Bearer ${localStorage.token}` : "" } })
      .then((r) => (r.ok ? r.json() : []))
      .then(setTasks)
  }, [])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch("/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: localStorage.token ? `Bearer ${localStorage.token}` : "",
      },
      body: JSON.stringify({ description: text }),
    })
    if (res.ok) {
      setText("")
      setMsg("Задача создана")
      setTasks(await res.json().then((t) => [...tasks, t]))
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Задачи</h2>
      <form onSubmit={add} className="space-x-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          className="rounded border px-2 py-1"
          placeholder="Описание"
        />
        <button type="submit" className="rounded bg-blue-500 px-3 py-1 text-white">
          Создать
        </button>
      </form>
      <ul className="space-y-1">
        {tasks.map((t) => (
          <li key={t._id} className="rounded border p-2">
            {t.task_description}
          </li>
        ))}
      </ul>
      {msg && <NotificationBar message={msg} />}
    </div>
  )
}
