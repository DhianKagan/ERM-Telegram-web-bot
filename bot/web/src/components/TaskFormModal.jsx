// Модальное окно создания задачи с выбором локаций и типом
import React from "react";
import { createTask } from "../services/tasks";

export default function TaskFormModal({ onClose, onCreate }) {
  const [title, setTitle] = React.useState("");
  const [taskType, setTaskType] = React.useState("Доставить");
  const [description, setDescription] = React.useState("");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [users, setUsers] = React.useState([]);

  React.useEffect(() => {
    fetch("/api/users", {
      headers: {
        Authorization: localStorage.token ? `Bearer ${localStorage.token}` : "",
      },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers);
  }, []);

  React.useEffect(() => {
    if (!end) setEnd(start);
  }, [start]);

  const addTag = (e) => {
    const id = e.target.value;
    if (!id) return;
    const user = users.find((u) => String(u.telegram_id) === id);
    if (user) {
      const tag = `<a href="tg://user?id=${user.telegram_id}">${user.username}</a>`;
      setDescription((d) => `${d} ${tag} `);
      e.target.value = "";
    }
  };

  const submit = async () => {
    const data = await createTask({
      title,
      task_type: taskType,
      task_description: description,
      start_location: start,
      end_location: end,
      status: "new",
    });
    if (data && onCreate) onCreate(data);
    onClose();
  };

  return (
    <div className="bg-opacity-30 animate-fade-in fixed inset-0 flex items-center justify-center bg-black">
      <div className="w-96 space-y-4 rounded-xl bg-white p-6 shadow-lg transition-all duration-150 dark:bg-gray-800">
        <h3 className="text-lg font-semibold">Новая задача</h3>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название"
          className="focus:border-brand-500 focus:ring-brand-200 w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-800 placeholder-gray-500 focus:ring focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value)}
          className="w-full rounded border px-2 py-1"
        >
          {["Доставить", "Купить", "Выполнить"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div>
          <label className="block text-sm font-medium">Старт точка</label>
          <input
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
          {start && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(start)}`}
              target="_blank"
              rel="noopener"
              className="text-brand-500 text-xs underline"
            >
              Карта
            </a>
          )}
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d163531.9947723061!2d30.546979357465514!3d46.4598536383166!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x40c6318a0b864c43%3A0x129f8fe28cf2176c!2z0J7QtNC10YHRgdCwLCDQntC00LXRgdGB0LrQsNGPINC-0LHQu9Cw0YHRgtGMLCA2NTAwMA!5e1!3m2!1sru!2sua!4v1750872987991!5m2!1sru!2sua"
            width="400"
            height="300"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>
        <div>
          <label className="block text-sm font-medium">Финальная точка</label>
          <input
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
          {end && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(end)}`}
              target="_blank"
              rel="noopener"
              className="text-brand-500 text-xs underline"
            >
              Карта
            </a>
          )}
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d163531.9947723061!2d30.546979357465514!3d46.4598536383166!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x40c6318a0b864c43%3A0x129f8fe28cf2176c!2z0J7QtNC10YHRgdCwLCDQntC00LXRgdGB0LrQsNGPINC-0LHQu9Cw0YHRgtGMLCA2NTAwMA!5e1!3m2!1sru!2sua!4v1750872987991!5m2!1sru!2sua"
            width="400"
            height="300"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>
        <div>
          <label className="block text-sm font-medium">🔨 Задача</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 mb-2 w-full rounded border px-2 py-1"
          />
          <select onChange={addTag} className="w-full rounded border px-2 py-1">
            <option value="">@ упомянуть</option>
            {users.map((u) => (
              <option key={u.telegram_id} value={u.telegram_id}>
                {u.username}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end space-x-2">
          <button className="btn-gray" onClick={onClose}>
            Отмена
          </button>
          <button className="btn-blue" onClick={submit}>
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}
