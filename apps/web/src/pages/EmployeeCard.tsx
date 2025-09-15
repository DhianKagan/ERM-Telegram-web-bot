// Назначение: страница карточки сотрудника с формой редактирования
// Основные модули: React, React Router, сервисы пользователей и коллекций
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import Breadcrumbs from "../components/Breadcrumbs";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  fetchCollectionItems,
  type CollectionItem,
} from "../services/collections";
import { fetchRoles, type Role } from "../services/roles";
import {
  fetchUser,
  updateUser,
  type UserDetails,
} from "../services/users";
import { useAuth } from "../context/useAuth";
import { showToast } from "../utils/toast";
import type { UserFormData } from "./Settings/UserForm";

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

function normalize(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") return String(value);
  return String(value);
}

export default function EmployeeCard() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [form, setForm] = useState<UserFormData | null>(null);
  const [initialForm, setInitialForm] = useState<UserFormData | null>(null);
  const [departments, setDepartments] = useState<CollectionItem[]>([]);
  const [divisions, setDivisions] = useState<CollectionItem[]>([]);
  const [positions, setPositions] = useState<CollectionItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);

  const canEdit = user?.role === "admin";

  useEffect(() => {
    fetchCollectionItems("departments", "", 1, 100).then((d) =>
      setDepartments(d.items),
    );
    fetchCollectionItems("divisions", "", 1, 100).then((d) =>
      setDivisions(d.items),
    );
    fetchCollectionItems("roles", "", 1, 100).then((d) =>
      setPositions(d.items),
    );
    fetchRoles().then((list) => setRoles(list));
  }, []);

  useEffect(() => {
    if (!id) {
      setError("Некорректный идентификатор пользователя");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchUser(id)
      .then((data) => {
        if (!data) {
          setError("Пользователь не найден");
          setForm(null);
          setInitialForm(null);
          return;
        }
        const mapped = mapUserToForm(data);
        setForm(mapped);
        setInitialForm({ ...mapped });
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : "Ошибка загрузки";
        setError(message || "Ошибка загрузки");
        setForm(null);
        setInitialForm(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const isDirty = useMemo(() => {
    if (!canEdit || !form || !initialForm) return false;
    const keys = Object.keys(initialForm) as (keyof UserFormData)[];
    return keys.some((key) => normalize(form[key]) !== normalize(initialForm[key]));
  }, [canEdit, form, initialForm]);

  const updateField = <K extends keyof UserFormData>(
    key: K,
    value: UserFormData[K],
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleRoleChange = (value: string) => {
    if (!form) return;
    const role = roles.find((r) => r.name === value);
    setForm({
      ...form,
      role: value,
      roleId: role?._id || form.roleId,
      access: role?.access ?? form.access,
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || !isDirty) return;
    setConfirmSave(true);
  };

  const resetChanges = () => {
    if (!initialForm) return;
    setForm({ ...initialForm });
  };

  const confirmUpdate = async () => {
    if (!form?.telegram_id) {
      setConfirmSave(false);
      return;
    }
    setSaving(true);
    try {
      const { telegram_id: telegramId, ...payload } = form;
      const updated = await updateUser(telegramId, payload);
      if (!updated) throw new Error("Не удалось сохранить изменения");
      const mapped = mapUserToForm(updated);
      setForm(mapped);
      setInitialForm({ ...mapped });
      showToast("Данные сотрудника сохранены", "success");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Не удалось сохранить";
      showToast(message, "error");
    } finally {
      setSaving(false);
      setConfirmSave(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <Breadcrumbs
        items={[
          { label: "Задачи", href: "/tasks" },
          { label: "Сотрудники", href: "/cp/settings" },
          { label: id ? `ID ${id}` : "Карточка" },
        ]}
      />
      {loading && <div>Загрузка...</div>}
      {!loading && error && <div className="text-red-600">{error}</div>}
      {!loading && !error && form && (
        <form
          onSubmit={handleSubmit}
          className="mx-auto max-w-3xl space-y-4 rounded bg-white p-6 shadow"
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
                readOnly
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Username</span>
              <input
                className="h-10 w-full rounded border px-3"
                value={form.username || ""}
                onChange={(e) => updateField("username", e.target.value)}
                disabled={!canEdit}
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
                Сбросить
              </button>
            </div>
          )}
        </form>
      )}
      <ConfirmDialog
        open={confirmSave}
        message="Сохранить изменения сотрудника?"
        onConfirm={confirmUpdate}
        onCancel={() => setConfirmSave(false)}
        confirmText="Сохранить"
      />
    </div>
  );
}
