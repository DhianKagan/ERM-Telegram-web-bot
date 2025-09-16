// Назначение: форма карточки сотрудника для создания и редактирования пользователей.
// Основные модули: React, services/users, services/collections, services/roles.
import { useEffect, useMemo, useState, type FormEvent } from "react";
import clsx from "clsx";
import ConfirmDialog from "./ConfirmDialog";
import {
  fetchCollectionItems,
  type CollectionItem,
} from "../services/collections";
import { fetchRoles, type Role } from "../services/roles";
import {
  createUser,
  fetchUser,
  updateUser,
  type UserDetails,
} from "../services/users";
import { useAuth } from "../context/useAuth";
import { showToast } from "../utils/toast";
import type { UserFormData } from "../pages/Settings/UserForm";

interface EmployeeCardFormProps {
  telegramId?: string;
  className?: string;
  allowCreate?: boolean;
  onSaved?: (user: UserDetails) => void;
}

const emptyForm: UserFormData = {
  telegram_id: undefined,
  username: "",
  name: "",
  phone: "",
  mobNumber: "",
  email: "",
  role: "user",
  access: 1,
  roleId: "",
  departmentId: "",
  divisionId: "",
  positionId: "",
};

function mapUserToForm(user: UserDetails): UserFormData {
  return {
    telegram_id: user.telegram_id,
    username: user.telegram_username || user.username || "",
    name: user.name || "",
    phone: user.phone || "",
    mobNumber: user.mobNumber || "",
    email: user.email || "",
    role: user.role || "user",
    access: user.access,
    roleId: user.roleId || "",
    departmentId: user.departmentId || "",
    divisionId: user.divisionId || "",
    positionId: user.positionId || "",
  };
}

const normalize = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") return String(value);
  return String(value);
};

export default function EmployeeCardForm({
  telegramId,
  className,
  allowCreate = false,
  onSaved,
}: EmployeeCardFormProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<UserFormData>({ ...emptyForm });
  const [initialForm, setInitialForm] = useState<UserFormData>({ ...emptyForm });
  const [departments, setDepartments] = useState<CollectionItem[]>([]);
  const [divisions, setDivisions] = useState<CollectionItem[]>([]);
  const [positions, setPositions] = useState<CollectionItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState<boolean>(!!telegramId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);

  const isCreateMode = !telegramId;
  const canEdit = user?.role === "admin";

  useEffect(() => {
    fetchCollectionItems("departments", "", 1, 100).then((d) =>
      setDepartments(d.items),
    ).catch(() => setDepartments([]));
    fetchCollectionItems("divisions", "", 1, 100).then((d) =>
      setDivisions(d.items),
    ).catch(() => setDivisions([]));
    fetchCollectionItems("positions", "", 1, 100).then((d) =>
      setPositions(d.items),
    ).catch(() => setPositions([]));
    fetchRoles().then((list) => setRoles(list));
  }, []);

  useEffect(() => {
    if (!telegramId) {
      setLoading(false);
      setError(null);
      setForm({ ...emptyForm });
      setInitialForm({ ...emptyForm });
      return;
    }
    setLoading(true);
    setError(null);
    fetchUser(telegramId)
      .then((data) => {
        if (!data) {
          setError("Пользователь не найден");
          setForm({ ...emptyForm });
          setInitialForm({ ...emptyForm });
          return;
        }
        const mapped = mapUserToForm(data);
        setForm(mapped);
        setInitialForm({ ...mapped });
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : "Ошибка загрузки";
        setError(message || "Ошибка загрузки");
        setForm({ ...emptyForm });
        setInitialForm({ ...emptyForm });
      })
      .finally(() => setLoading(false));
  }, [telegramId]);

  const isDirty = useMemo(() => {
    if (!canEdit) return false;
    if (isCreateMode) {
      return Boolean(form.telegram_id && form.username);
    }
    const keys = Object.keys(initialForm) as (keyof UserFormData)[];
    return keys.some((key) => normalize(form[key]) !== normalize(initialForm[key]));
  }, [canEdit, form, initialForm, isCreateMode]);

  const updateField = <K extends keyof UserFormData>(
    key: K,
    value: UserFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleRoleChange = (value: string) => {
    const role = roles.find((r) => r.name === value);
    setForm((prev) => ({
      ...prev,
      role: value,
      roleId: role?._id || prev.roleId,
      access: role?.access ?? prev.access,
    }));
  };

  const resetChanges = () => {
    if (isCreateMode) {
      setForm({ ...emptyForm });
      return;
    }
    setForm({ ...initialForm });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) return;
    if (!isDirty) return;
    setConfirmSave(true);
  };

  const persistChanges = async () => {
    if (!canEdit) {
      setConfirmSave(false);
      return;
    }
    if (isCreateMode) {
      if (!form.telegram_id || !form.username) {
        showToast("Укажите ID и username сотрудника", "error");
        setConfirmSave(false);
        return;
      }
      setSaving(true);
      try {
        const telegramIdValue = Number(form.telegram_id);
        if (!Number.isFinite(telegramIdValue)) {
          throw new Error("ID должен быть числом");
        }
        await createUser(telegramIdValue, form.username, form.roleId);
        const { telegram_id: _, ...payload } = form;
        const updated = await updateUser(telegramIdValue, payload);
        if (!updated) throw new Error("Не удалось сохранить изменения");
        const mapped = mapUserToForm(updated);
        setForm(mapped);
        setInitialForm({ ...mapped });
        onSaved?.(updated);
        showToast("Сотрудник создан", "success");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Не удалось сохранить";
        showToast(message, "error");
      } finally {
        setSaving(false);
        setConfirmSave(false);
      }
      return;
    }
    if (!form.telegram_id) {
      setConfirmSave(false);
      return;
    }
    setSaving(true);
    try {
      const { telegram_id: telegramIdValue, ...payload } = form;
      const updated = await updateUser(telegramIdValue, payload);
      if (!updated) throw new Error("Не удалось сохранить изменения");
      const mapped = mapUserToForm(updated);
      setForm(mapped);
      setInitialForm({ ...mapped });
      onSaved?.(updated);
      showToast("Данные сотрудника сохранены", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось сохранить";
      showToast(message, "error");
    } finally {
      setSaving(false);
      setConfirmSave(false);
    }
  };

  if (!telegramId && !allowCreate) {
    return <div className="text-sm text-gray-500">Выберите сотрудника слева</div>;
  }

  return (
    <div className={clsx("space-y-4", className)}>
      {loading && <div>Загрузка...</div>}
      {!loading && error && <div className="text-red-600">{error}</div>}
      {!loading && !error && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded bg-white p-6 shadow"
        >
          {!canEdit && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              У вас нет прав на редактирование, данные доступны только для чтения.
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-sm font-medium">ID</span>
              <input
                className="h-10 w-full rounded border px-3"
                value={form.telegram_id ?? ""}
                onChange={(e) =>
                  updateField(
                    "telegram_id",
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                readOnly={!isCreateMode}
                required
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Username</span>
              <input
                className="h-10 w-full rounded border px-3"
                value={form.username || ""}
                onChange={(e) => updateField("username", e.target.value)}
                readOnly={!isCreateMode}
                required
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Имя</span>
              <input
                className="h-10 w-full rounded border px-3"
                value={form.name || ""}
                onChange={(e) => updateField("name", e.target.value)}
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Телефон</span>
              <input
                className="h-10 w-full rounded border px-3"
                value={form.phone || ""}
                onChange={(e) => updateField("phone", e.target.value)}
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Доп. телефон</span>
              <input
                className="h-10 w-full rounded border px-3"
                value={form.mobNumber || ""}
                onChange={(e) => updateField("mobNumber", e.target.value)}
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Email</span>
              <input
                className="h-10 w-full rounded border px-3"
                value={form.email || ""}
                onChange={(e) => updateField("email", e.target.value)}
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Роль</span>
              <select
                className="h-10 w-full rounded border px-3"
                value={form.role || "user"}
                onChange={(e) => handleRoleChange(e.target.value)}
                disabled={!canEdit}
              >
                <option value="user">user</option>
                <option value="manager">manager</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Департамент</span>
              <select
                className="h-10 w-full rounded border px-3"
                value={form.departmentId || ""}
                onChange={(e) => updateField("departmentId", e.target.value)}
                disabled={!canEdit}
              >
                <option value=""></option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Отдел</span>
              <select
                className="h-10 w-full rounded border px-3"
                value={form.divisionId || ""}
                onChange={(e) => updateField("divisionId", e.target.value)}
                disabled={!canEdit}
              >
                <option value=""></option>
                {divisions.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Должность</span>
              <select
                className="h-10 w-full rounded border px-3"
                value={form.positionId || ""}
                onChange={(e) => updateField("positionId", e.target.value)}
                disabled={!canEdit}
              >
                <option value=""></option>
                {positions.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {canEdit && (
            <div className="flex gap-3">
              <button
                type="submit"
                className="btn btn-blue"
                disabled={!isDirty || saving}
              >
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
              <button
                type="button"
                className="btn btn-gray"
                onClick={resetChanges}
                disabled={!isDirty || saving}
              >
                Очистить
              </button>
            </div>
          )}
        </form>
      )}
      <ConfirmDialog
        open={confirmSave}
        message={isCreateMode ? "Создать сотрудника?" : "Сохранить изменения сотрудника?"}
        onConfirm={persistChanges}
        onCancel={() => setConfirmSave(false)}
        confirmText="Сохранить"
      />
    </div>
  );
}
