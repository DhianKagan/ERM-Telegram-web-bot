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
  access?: number;
  roleId?: string;
  receive_reminders?: boolean;
}

interface Props {
  form: UserFormData;
  onChange: (form: UserFormData) => void;
  onSubmit: () => void;
  onReset: () => void;
}

export default function UserForm({ form, onChange, onSubmit, onReset }: Props) {
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
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium">Доступ</label>
        <input
          type="number"
          className="h-10 w-full rounded border px-3"
          value={form.access ?? 1}
          onChange={(e) =>
            onChange({ ...form, access: Number(e.target.value) })
          }
        />
      </div>
      <div>
        <label className="block text-sm font-medium">roleId</label>
        <input
          className="h-10 w-full rounded border px-3"
          value={form.roleId || ""}
          onChange={(e) => onChange({ ...form, roleId: e.target.value })}
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.receive_reminders ?? true}
          onChange={(e) =>
            onChange({ ...form, receive_reminders: e.target.checked })
          }
        />
        <span className="text-sm">Напоминания</span>
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
