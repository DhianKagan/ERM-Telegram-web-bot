// Назначение: форма редактирования пользователя
// Основные модули: React, ConfirmDialog
import React from "react";
import ConfirmDialog from "../../components/ConfirmDialog";
import {
  fetchCollectionItems,
  type CollectionItem,
} from "../../services/collections";
import { fetchRoles } from "../../services/roles";
import { ROLE_OPTIONS } from "../../utils/roleDisplay";

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
  departmentId?: string;
  divisionId?: string;
  positionId?: string;
}

interface Props {
  form: UserFormData;
  onChange: (form: UserFormData) => void;
  onSubmit: () => void;
  onReset: () => void;
}

interface Role {
  _id: string;
  name: string;
  access: number;
}

export default function UserForm({ form, onChange, onSubmit, onReset }: Props) {
  const [confirmSave, setConfirmSave] = React.useState(false);
  const [departments, setDepartments] = React.useState<CollectionItem[]>([]);
  const [divisions, setDivisions] = React.useState<CollectionItem[]>([]);
  const [positions, setPositions] = React.useState<CollectionItem[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);

  React.useEffect(() => {
    fetchCollectionItems("departments", "", 1, 100).then((d) =>
      setDepartments(d.items),
    ).catch(() => setDepartments([]));
    fetchCollectionItems("divisions", "", 1, 100).then((d) =>
      setDivisions(d.items),
    ).catch(() => setDivisions([]));
    fetchCollectionItems("positions", "", 1, 100).then((d) =>
      setPositions(d.items),
    ).catch(() => setPositions([]));
    fetchRoles().then((r) => setRoles(r));
  }, []);

  const handleRoleChange = (value: string) => {
    const r = roles.find((x) => x.name === value);
    onChange({
      ...form,
      role: value,
      roleId: r?._id,
      access: r?.access ?? 1,
    });
  };

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
            onChange({
              ...form,
              telegram_id: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          readOnly={!!form.telegram_id}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Username</label>
        <input
          className="h-10 w-full rounded border px-3"
          value={form.username || ""}
          onChange={(e) => onChange({ ...form, username: e.target.value })}
          readOnly={!!form.telegram_id}
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
          onChange={(e) => handleRoleChange(e.target.value)}
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium">Департамент</label>
        <select
          className="h-10 w-full rounded border px-3"
          value={form.departmentId || ""}
          onChange={(e) => onChange({ ...form, departmentId: e.target.value })}
        >
          <option value=""></option>
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
          <option value=""></option>
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
          <option value=""></option>
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
