// Модальное окно создания задачи с выбором локаций и типом
import React, { useContext } from "react";
import { createTask } from "../services/tasks";
import MapSelector from "./MapSelector";
import { validateURL } from "../utils/validation";
import authFetch from "../utils/authFetch";
import RichTextEditor from "./RichTextEditor";
import { AuthContext } from "../context/AuthContext";

const TYPES = [
  { id: 1, label: "Доставить" },
  { id: 2, label: "Купить" },
  { id: 3, label: "Выполнить" },
];

const PRIORITIES = [
  { id: 1, label: "Срочно" },
  { id: 2, label: "В течении дня" },
  { id: 3, label: "Бессрочно" },
];

export default function TaskFormModal({ onClose, onCreate }) {
  const [title, setTitle] = React.useState("");
  const [taskType, setTaskType] = React.useState("Доставить");
  const [description, setDescription] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [priority, setPriority] = React.useState("В течении дня");
  const [creator, setCreator] = React.useState("");
  const [assignees, setAssignees] = React.useState([]);
  const [start, setStart] = React.useState("");
  const [startLink, setStartLink] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [endLink, setEndLink] = React.useState("");
  const [showStartMap, setShowStartMap] = React.useState(false);
  const [showEndMap, setShowEndMap] = React.useState(false);
  const [users, setUsers] = React.useState([]);
  const [groups, setGroups] = React.useState([]);
  const [roles, setRoles] = React.useState([]);
  const { user } = useContext(AuthContext);

  React.useEffect(() => {
    authFetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        setUsers(list);
        if (user) setCreator(user.telegram_id);
      });
    authFetch("/api/groups")
      .then((r) => (r.ok ? r.json() : []))
      .then(setGroups);
    authFetch("/api/roles")
      .then((r) => (r.ok ? r.json() : []))
      .then(setRoles);
  }, [user]);

  React.useEffect(() => {
    if (!end) {
      setEnd(start);
      setEndLink(startLink);
    }
  }, [start, startLink]);

  const addTag = (e, setter) => {
    const id = e.target.value;
    if (!id) return;
    let tag = "";
    if (id.startsWith("group:")) {
      const g = groups.find((r) => `group:${r._id}` === id);
      if (g) tag = `<span data-group="${g._id}">${g.name}</span>`;
    } else if (id.startsWith("role:")) {
      const r = roles.find((ro) => `role:${ro._id}` === id);
      if (r) tag = `<span data-role="${r._id}">${r.name}</span>`;
    } else {
      const user = users.find((u) => String(u.telegram_id) === id);
      if (user)
        tag = `<a href="tg://user?id=${user.telegram_id}">${user.username}</a>`;
    }
    if (tag) {
      setter((d) => `${d} ${tag} `);
      e.target.value = "";
    }
  };

  const submit = async () => {
    const data = await createTask({
      title,
      task_type: taskType,
      task_type_id: TYPES.find((t) => t.label === taskType)?.id,
      task_description: description,
      comment,
      priority,
      priority_id: PRIORITIES.find((p) => p.label === priority)?.id,
      created_by: creator,
      assignees,
      start_location: start,
      start_location_link: startLink,
      end_location: end,
      end_location_link: endLink,
      status: "new",
    });
    if (data && onCreate) onCreate(data);
    onClose();
  };

  return (
    <div className="bg-opacity-30 animate-fade-in fixed inset-0 flex items-center justify-center bg-black">
      <div className="w-96 space-y-4 rounded-xl bg-white p-6 shadow-lg transition-all duration-150 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Новая задача</h3>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="rounded border px-2 py-1"
          >
            {PRIORITIES.map((p) => (
              <option key={p.id} value={p.label}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
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
          {TYPES.map((t) => (
            <option key={t.id} value={t.label}>
              {t.label}
            </option>
          ))}
        </select>
        <div>
          <label className="block text-sm font-medium">Задачу создал</label>
          <select
            value={creator}
            onChange={(e) => setCreator(e.target.value)}
            className="w-full rounded border px-2 py-1"
          >
            <option value="">автор</option>
            {users.map((u) => (
              <option key={u.telegram_id} value={u.telegram_id}>
                {u.username}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Исполнител(и)ь</label>
          <select
            multiple
            value={assignees}
            onChange={(e) =>
              setAssignees(Array.from(e.target.selectedOptions).map((o) => o.value))
            }
            className="w-full rounded border px-2 py-1"
          >
            {users.map((u) => (
              <option key={u.telegram_id} value={u.telegram_id}>
                {u.username}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Старт точка</label>
          {startLink ? (
            <a
              href={startLink}
              target="_blank"
              rel="noopener"
              className="text-brand-500 underline"
            >
              {start || "ссылка"}
            </a>
          ) : (
            <span className="text-gray-500">не выбрано</span>
          )}
          <button
            type="button"
            onClick={() => setShowStartMap(true)}
            className="btn-blue ml-2 rounded-full"
          >
            Карта
          </button>
        </div>
        {showStartMap && (
          <MapSelector
            onSelect={({ link, address }) => {
              setStart(address);
              setStartLink(link);
            }}
            onClose={() => setShowStartMap(false)}
          />
        )}
        <div>
          <label className="block text-sm font-medium">Финальная точка</label>
          {endLink ? (
            <a
              href={endLink}
              target="_blank"
              rel="noopener"
              className="text-brand-500 underline"
            >
              {end || "ссылка"}
            </a>
          ) : (
            <span className="text-gray-500">не выбрано</span>
          )}
          <button
            type="button"
            onClick={() => setShowEndMap(true)}
            className="btn-blue ml-2 rounded-full"
          >
            Карта
          </button>
        </div>
        {showEndMap && (
          <MapSelector
            onSelect={({ link, address }) => {
              setEnd(address);
              setEndLink(validateURL(link));
            }}
            onClose={() => setShowEndMap(false)}
          />
        )}
        <div>
          <label className="block text-sm font-medium">🔨 Задача</label>
          <RichTextEditor value={description} onChange={setDescription} />
          <select onChange={(e) => addTag(e, setDescription)} className="mt-2 w-full rounded border px-2 py-1">
            <option value="">@ упомянуть</option>
            <optgroup label="Пользователи">
              {users.map((u) => (
                <option key={u.telegram_id} value={u.telegram_id}>
                  {u.username}
                </option>
              ))}
            </optgroup>
            <optgroup label="Группы">
              {groups.map((g) => (
                <option key={g._id} value={`group:${g._id}`}>{g.name}</option>
              ))}
            </optgroup>
            <optgroup label="Роли">
              {roles.map((r) => (
                <option key={r._id} value={`role:${r._id}`}>{r.name}</option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Комментарий</label>
          <RichTextEditor value={comment} onChange={setComment} />
          <select onChange={(e) => addTag(e, setComment)} className="mt-2 w-full rounded border px-2 py-1">
            <option value="">@ упомянуть</option>
            <optgroup label="Пользователи">
              {users.map((u) => (
                <option key={u.telegram_id} value={u.telegram_id}>
                  {u.username}
                </option>
              ))}
            </optgroup>
            <optgroup label="Группы">
              {groups.map((g) => (
                <option key={g._id} value={`group:${g._id}`}>{g.name}</option>
              ))}
            </optgroup>
            <optgroup label="Роли">
              {roles.map((r) => (
                <option key={r._id} value={`role:${r._id}`}>{r.name}</option>
              ))}
            </optgroup>
          </select>
        </div>
        <div className="flex justify-end space-x-2">
          <button className="btn-gray rounded-full" onClick={onClose}>
            Отмена
          </button>
          <button className="btn-blue rounded-full" onClick={submit}>
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}
