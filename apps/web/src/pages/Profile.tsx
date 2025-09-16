// Назначение: страница профиля пользователя
// Основные модули: React, React Router
import { useEffect, useMemo, useState, type FormEvent } from "react";
import Breadcrumbs from "../components/Breadcrumbs";
import { useAuth } from "../context/useAuth";
import { updateProfile } from "../services/auth";
import { fetchCollectionItems, type CollectionItem } from "../services/collections";
import { showToast } from "../utils/toast";

interface EditableProfileForm {
  name: string;
  phone: string;
  email: string;
}

const roleTitles: Record<string, string> = {
  admin: "Администратор",
  manager: "Менеджер",
  user: "Пользователь",
};

const defaultForm: EditableProfileForm = {
  name: "",
  phone: "",
  email: "",
};

const parseCollection = (items: CollectionItem[]) => {
  const map = new Map<string, string>();
  items.forEach((item) => {
    map.set(item._id, item.name);
  });
  return map;
};

export default function Profile() {
  const { user, setUser, loading } = useAuth();
  const [form, setForm] = useState<EditableProfileForm>({ ...defaultForm });
  const [initialForm, setInitialForm] = useState<EditableProfileForm>({
    ...defaultForm,
  });
  const [departments, setDepartments] = useState<CollectionItem[]>([]);
  const [divisions, setDivisions] = useState<CollectionItem[]>([]);
  const [positions, setPositions] = useState<CollectionItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCollectionItems("departments", "", 1, 200).then((d) =>
      setDepartments(d.items),
    ).catch(() => setDepartments([]));
    fetchCollectionItems("divisions", "", 1, 200).then((d) =>
      setDivisions(d.items),
    ).catch(() => setDivisions([]));
    fetchCollectionItems("positions", "", 1, 200).then((d) =>
      setPositions(d.items),
    ).catch(() => setPositions([]));
  }, []);

  useEffect(() => {
    if (!user) return;
    const next: EditableProfileForm = {
      name: user.name || user.telegram_username || "",
      phone: user.phone || "",
      email: user.email || "",
    };
    setForm(next);
    setInitialForm(next);
    setError(null);
  }, [user]);

  const departmentMap = useMemo(() => parseCollection(departments), [
    departments,
  ]);
  const divisionMap = useMemo(() => parseCollection(divisions), [divisions]);
  const positionMap = useMemo(() => parseCollection(positions), [positions]);

  const departmentName = useMemo(() => {
    if (!user?.departmentId) return "";
    return departmentMap.get(user.departmentId) || "";
  }, [departmentMap, user?.departmentId]);

  const divisionName = useMemo(() => {
    if (!user?.divisionId) return "";
    return divisionMap.get(user.divisionId) || "";
  }, [divisionMap, user?.divisionId]);

  const positionName = useMemo(() => {
    if (!user?.positionId) return "";
    return positionMap.get(user.positionId) || "";
  }, [positionMap, user?.positionId]);

  const updateField = <K extends keyof EditableProfileForm>(
    key: K,
    value: EditableProfileForm[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isDirty = useMemo(() => {
    return (
      form.name !== initialForm.name ||
      form.phone !== initialForm.phone ||
      form.email !== initialForm.email
    );
  }, [form, initialForm]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !isDirty || saving) return;
    const trimmedName = form.name.trim();
    const trimmedPhone = form.phone.trim();
    const trimmedEmail = form.email.trim();
    setSaving(true);
    setError(null);
    try {
      const data = await updateProfile({
        name: trimmedName,
        phone: trimmedPhone || undefined,
        email: trimmedEmail,
      });
      setUser(data);
      const next: EditableProfileForm = {
        name: data.name || data.telegram_username || "",
        phone: data.phone || "",
        email: data.email || "",
      };
      setForm(next);
      setInitialForm(next);
      showToast("Профиль обновлён", "success");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Не удалось обновить профиль";
      setError(message);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm(initialForm);
    setError(null);
  };

  if (loading) return <div>Загрузка...</div>;
  if (!user) return <div>Профиль недоступен</div>;

  const roleLabel = user.role ? roleTitles[user.role] || user.role : "—";
  const telegramId = user.telegram_id
    ? String(user.telegram_id)
    : user.id || "";
  const telegramUsername = user.telegram_username || "—";
  const additionalPhone = user.mobNumber || "—";

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Задачи", href: "/tasks" }, { label: "Профиль" }]}
      />
      <div className="mx-auto max-w-4xl space-y-4">
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded bg-white p-8 shadow"
        >
          <h2 className="text-2xl">Личный кабинет</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="block text-sm font-medium">ФИО</span>
              <input
                className="h-10 w-full rounded border px-3"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Телефон</span>
              <input
                className="h-10 w-full rounded border px-3"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                type="tel"
                placeholder=""
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Email</span>
              <input
                className="h-10 w-full rounded border px-3"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                type="email"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Доп. телефон</span>
              <input
                className="h-10 w-full rounded border bg-gray-100 px-3 text-gray-600"
                value={additionalPhone}
                readOnly
                disabled
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Telegram ID</span>
              <input
                className="h-10 w-full rounded border bg-gray-100 px-3 text-gray-600"
                value={telegramId}
                readOnly
                disabled
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Username</span>
              <input
                className="h-10 w-full rounded border bg-gray-100 px-3 text-gray-600"
                value={telegramUsername}
                readOnly
                disabled
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Роль</span>
              <input
                className="h-10 w-full rounded border bg-gray-100 px-3 text-gray-600"
                value={roleLabel}
                readOnly
                disabled
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Департамент</span>
              <input
                className="h-10 w-full rounded border bg-gray-100 px-3 text-gray-600"
                value={departmentName || "—"}
                readOnly
                disabled
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Отдел</span>
              <input
                className="h-10 w-full rounded border bg-gray-100 px-3 text-gray-600"
                value={divisionName || "—"}
                readOnly
                disabled
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Должность</span>
              <input
                className="h-10 w-full rounded border bg-gray-100 px-3 text-gray-600"
                value={positionName || "—"}
                readOnly
                disabled
              />
            </label>
          </div>
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
              onClick={resetForm}
              disabled={!isDirty || saving}
            >
              Отменить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
