// Назначение: форма редактирования пользователя
// Основные модули: React, ConfirmDialog
import React from "react";
import ConfirmDialog from "../../components/ConfirmDialog";

export interface UserFormData {
  telegram_id?: number;
  username?: string;
  name?: string;
  phone?: string;
  mobNumber?: string;
  email?: string;
  role?: string;
  departmentId?: string;
  divisionId?: string;
  positionId?: string;
}

interface Props {
  form: UserFormData;
  departments: { _id: string; name: string }[];
  divisions: { _id: string; name: string }[];
  positions: { _id: string; name: string }[];
  onChange: (form: UserFormData) => void;
  onSubmit: () => void;
  onReset: () => void;
}

export default function UserForm({
  form,
  departments,
  divisions,
  positions,
  onChange,
  onSubmit,
  onReset,
}: Props) {
  const [confirmSave, setConfirmSave] = React.useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmSave(true);
  };
  return (
    <form onSubmit={submit} className="space-y-2">
      <div>
        <label className="block text-sm font-medium">ID</label>
        <input
          className="h-10 w-full rounded border px-3"
          value={form.telegram_id ?? ""}
          disabled={Boolean(form.telegram_id)}
          onChange={(e) =>
            onChange({ ...form, telegram_id: Number(e.target.value) })
          }
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Username</label>
        <input
          className="h-10 w-full rounded border px-3"
          value={form.username || ""}
          disabled={Boolean(form.telegram_id)}
          onChange={(e) => onChange({ ...form, username: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Имя</label>
        <input
          className="h-10 w-full rounded border px-3"
          value={form.name || ""}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Телефон</label>
        <input
          className="h-10 w-full rounded border px-3"
          value={form.phone || ""}
          onChange={(e) => onChange({ ...form, phone: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Доп. телефон</label>
        <input
          className="h-10 w-full rounded border px-3"
          value={form.mobNumber || ""}
          onChange={(e) => onChange({ ...form, mobNumber: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input
          className="h-10 w-full rounded border px-3"
          value={form.email || ""}
          onChange={(e) => onChange({ ...form, email: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Роль</label>
        <select
          className="h-10 w-full rounded border px-3"
          value={form.role || "user"}
          onChange={(e) => onChange({ ...form, role: e.target.value })}
        >
          <option value="user">user</option>
          <option value="admin">admin</option>
          <option value="manager">manager</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium">Департамент</label>
        <select
          className="h-10 w-full rounded border px-3"
          value={form.departmentId || ""}
          onChange={(e) => onChange({ ...form, departmentId: e.target.value })}
        >
          <option value="">—</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium">Отдел</label>
        <select
          className="h-10 w-full rounded border px-3"
          value={form.divisionId || ""}
          onChange={(e) => onChange({ ...form, divisionId: e.target.value })}
        >
          <option value="">—</option>
          {divisions.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium">Должность</label>
        <select
          className="h-10 w-full rounded border px-3"
          value={form.positionId || ""}
          onChange={(e) => onChange({ ...form, positionId: e.target.value })}
        >
          <option value="">—</option>
          {positions.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-blue rounded">
          Сохранить
        </button>
        <button
          type="button"
          className="btn btn-gray rounded"
          onClick={onReset}
        >
          Очистить
        </button>
      </div>
      <ConfirmDialog
        open={confirmSave}
        message="Сохранить изменения?"
        onConfirm={() => {
          setConfirmSave(false);
          onSubmit();
        }}
        onCancel={() => setConfirmSave(false)}
        confirmText="Сохранить"
      />
    </form>
  );
}
