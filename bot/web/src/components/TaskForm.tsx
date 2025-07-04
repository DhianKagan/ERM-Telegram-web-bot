// Универсальная форма создания задачи
import React, { useContext } from "react";
import { createTask } from "../services/tasks";
import MapSelector from "./MapSelector";
import { validateURL } from "../utils/validation";
import authFetch from "../utils/authFetch";
import RichTextEditor from "./RichTextEditor";
import { AuthContext } from "../context/AuthContext";
import fields from "../../../shared/taskFields.cjs";

const TYPES = fields.find((f) => f.name === "task_type")?.options || [];
const PRIORITIES = fields.find((f) => f.name === "priority")?.options || [];
const TRANSPORTS = fields.find((f) => f.name === "transport_type")?.options || [];
const PAYMENTS = fields.find((f) => f.name === "payment_method")?.options || [];
const STATUSES = fields.find((f) => f.name === "status")?.options || [];
const DEFAULT_TYPE = fields.find((f) => f.name === "task_type")?.default || "";
const DEFAULT_PRIORITY = fields.find((f) => f.name === "priority")?.default || "";
const DEFAULT_TRANSPORT = fields.find((f) => f.name === "transport_type")?.default || "";
const DEFAULT_PAYMENT = fields.find((f) => f.name === "payment_method")?.default || "";
const DEFAULT_STATUS = fields.find((f) => f.name === "status")?.default || "";

interface TaskFormProps {
  onClose: () => void
  onCreate?: (data: unknown) => void
}

export default function TaskForm({ onClose, onCreate }: TaskFormProps) {
  const [title, setTitle] = React.useState("");
  const [taskType, setTaskType] = React.useState(DEFAULT_TYPE);
  const [description, setDescription] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [priority, setPriority] = React.useState(DEFAULT_PRIORITY);
  const [transportType, setTransportType] = React.useState(DEFAULT_TRANSPORT);
  const [paymentMethod, setPaymentMethod] = React.useState(DEFAULT_PAYMENT);
  const [status, setStatus] = React.useState(DEFAULT_STATUS);
  const [department, setDepartment] = React.useState("");
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
  const [departments, setDepartments] = React.useState([]);
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
    authFetch("/api/departments")
      .then((r) => (r.ok ? r.json() : []))
      .then(setDepartments);
  }, [user]);

  React.useEffect(() => {
    if (!end) {
      setEnd(start);
      setEndLink(startLink);
    }
  }, [start, startLink, end]);

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
        tag = `<a href="tg://user?id=${user.telegram_id}">${user.name || user.username}</a>`;
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
      task_description: description,
      comment,
      priority,
      transport_type: transportType,
      payment_method: paymentMethod,
      status,
      departmentId: department || undefined,
      created_by: creator,
      assignees,
      start_location: start,
      start_location_link: startLink,
      end_location: end,
      end_location_link: endLink,
    });
    if (data && onCreate) onCreate(data);
    onClose();
  };

  return (
    <div className="bg-opacity-30 animate-fade-in fixed inset-0 flex items-center justify-center bg-black">
      <div className="w-96 max-h-[90vh] overflow-y-auto space-y-4 rounded-xl bg-white p-6 shadow-lg transition-all duration-150">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Новая задача</h3>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="rounded border px-2 py-1"
          >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          </select>
        </div>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="w-full rounded border px-2 py-1"
        >
          <option value="">Отдел</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>{d.name}</option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название"
          className="focus:border-accentPrimary focus:ring-brand-200 w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-800 placeholder-gray-500 focus:ring focus:outline-none"
        />
        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value)}
          className="w-full rounded border px-2 py-1"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
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
                {u.name || u.username}
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
                {u.name || u.username}
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
              className="text-accentPrimary underline"
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
        <select
          value={transportType}
          onChange={(e) => setTransportType(e.target.value)}
          className="w-full rounded border px-2 py-1"
        >
          {TRANSPORTS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div>
          <label className="block text-sm font-medium">Финальная точка</label>
          {endLink ? (
            <a
              href={endLink}
              target="_blank"
              rel="noopener"
              className="text-accentPrimary underline"
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
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="w-full rounded border px-2 py-1"
        >
          {PAYMENTS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <div>
          <label className="block text-sm font-medium">🔨 Задача</label>
          <RichTextEditor value={description} onChange={setDescription} />
          <select onChange={(e) => addTag(e, setDescription)} className="mt-2 w-full rounded border px-2 py-1">
            <option value="">@ упомянуть</option>
            <optgroup label="Пользователи">
              {users.map((u) => (
                <option key={u.telegram_id} value={u.telegram_id}>
                  {u.name || u.username}
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
                  {u.name || u.username}
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
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full rounded border px-2 py-1"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
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
