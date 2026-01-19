// Назначение: страница профиля пользователя
// Основные модули: React, React Router
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { UserCircleIcon } from '@heroicons/react/24/outline';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormGroup } from '@/components/ui/form-group';
import { Input } from '@/components/ui/input';
import ActionBar from '../components/ActionBar';
import { useAuth } from '../context/useAuth';
import { updateProfile } from '../services/auth';
import {
  fetchCollectionItems,
  type CollectionItem,
} from '../services/collections';
import { showToast } from '../utils/toast';

interface EditableProfileForm {
  name: string;
  phone: string;
  email: string;
}

const roleTitles: Record<string, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  user: 'Пользователь',
};

const defaultForm: EditableProfileForm = {
  name: '',
  phone: '',
  email: '',
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
    fetchCollectionItems('departments', '', 1, 200)
      .then((d) => setDepartments(d.items))
      .catch(() => setDepartments([]));
    fetchCollectionItems('divisions', '', 1, 200)
      .then((d) => setDivisions(d.items))
      .catch(() => setDivisions([]));
    fetchCollectionItems('positions', '', 1, 200)
      .then((d) => setPositions(d.items))
      .catch(() => setPositions([]));
  }, []);

  useEffect(() => {
    if (!user) return;
    const next: EditableProfileForm = {
      name: user.name || user.telegram_username || '',
      phone: user.phone || '',
      email: user.email || '',
    };
    setForm(next);
    setInitialForm(next);
    setError(null);
  }, [user]);

  const departmentMap = useMemo(
    () => parseCollection(departments),
    [departments],
  );
  const divisionMap = useMemo(() => parseCollection(divisions), [divisions]);
  const positionMap = useMemo(() => parseCollection(positions), [positions]);

  const departmentName = useMemo(() => {
    const fallback =
      typeof user?.departmentName === 'string'
        ? user.departmentName.trim()
        : '';
    if (fallback) return fallback;
    const id =
      typeof user?.departmentId === 'string' ? user.departmentId.trim() : '';
    if (!id) return '';
    return departmentMap.get(id) || id;
  }, [departmentMap, user?.departmentId, user?.departmentName]);

  const divisionName = useMemo(() => {
    const fallback =
      typeof user?.divisionName === 'string' ? user.divisionName.trim() : '';
    if (fallback) return fallback;
    const id =
      typeof user?.divisionId === 'string' ? user.divisionId.trim() : '';
    if (!id) return '';
    return divisionMap.get(id) || id;
  }, [divisionMap, user?.divisionId, user?.divisionName]);

  const positionName = useMemo(() => {
    const fallback =
      typeof user?.positionName === 'string' ? user.positionName.trim() : '';
    if (fallback) return fallback;
    const id =
      typeof user?.positionId === 'string' ? user.positionId.trim() : '';
    if (!id) return '';
    return positionMap.get(id) || id;
  }, [positionMap, user?.positionId, user?.positionName]);

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
        name: data.name || data.telegram_username || '',
        phone: data.phone || '',
        email: data.email || '',
      };
      setForm(next);
      setInitialForm(next);
      showToast('Профиль обновлён', 'success');
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Не удалось обновить профиль';
      setError(message);
      showToast(message, 'error');
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

  const roleLabel = user.role ? roleTitles[user.role] || user.role : '—';
  const telegramId = user.telegram_id
    ? String(user.telegram_id)
    : user.id || '';
  const telegramUsername = user.telegram_username || '—';
  const additionalPhone = user.mobNumber || '—';

  return (
    <div className="space-y-6">
      <ActionBar
        icon={UserCircleIcon}
        title="Личный кабинет"
        description="Управляйте основными данными профиля и контактами."
      />
      <div className="w-full space-y-4">
        {error && (
          <Card className="border-destructive/30 bg-destructive/5 text-destructive">
            {error}
          </Card>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormGroup label="ФИО" htmlFor="profile-full-name">
                <Input
                  id="profile-full-name"
                  name="fullName"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  required
                />
              </FormGroup>
              <FormGroup label="Телефон" htmlFor="profile-phone">
                <Input
                  id="profile-phone"
                  name="phone"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  type="tel"
                  placeholder=""
                />
              </FormGroup>
              <FormGroup label="Email" htmlFor="profile-email">
                <Input
                  id="profile-email"
                  name="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  type="email"
                  required
                />
              </FormGroup>
              <FormGroup
                label="Доп. телефон"
                htmlFor="profile-additional-phone"
              >
                <Input
                  id="profile-additional-phone"
                  name="additionalPhone"
                  value={additionalPhone}
                  readOnly
                  disabled
                />
              </FormGroup>
              <FormGroup label="Telegram ID" htmlFor="profile-telegram-id">
                <Input
                  id="profile-telegram-id"
                  name="telegramId"
                  value={telegramId}
                  readOnly
                  disabled
                />
              </FormGroup>
              <FormGroup label="Username" htmlFor="profile-telegram-username">
                <Input
                  id="profile-telegram-username"
                  name="telegramUsername"
                  value={telegramUsername}
                  readOnly
                  disabled
                />
              </FormGroup>
              <FormGroup label="Роль" htmlFor="profile-role">
                <Input
                  id="profile-role"
                  name="role"
                  value={roleLabel}
                  readOnly
                  disabled
                />
              </FormGroup>
              <FormGroup label="Департамент" htmlFor="profile-department">
                <Input
                  id="profile-department"
                  name="department"
                  value={departmentName || '—'}
                  readOnly
                  disabled
                />
              </FormGroup>
              <FormGroup label="Отдел" htmlFor="profile-division">
                <Input
                  id="profile-division"
                  name="division"
                  value={divisionName || '—'}
                  readOnly
                  disabled
                />
              </FormGroup>
              <FormGroup label="Должность" htmlFor="profile-position">
                <Input
                  id="profile-position"
                  name="position"
                  value={positionName || '—'}
                  readOnly
                  disabled
                />
              </FormGroup>
            </div>
          </Card>
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              size="sm"
              variant="primary"
              disabled={!isDirty || saving}
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={resetForm}
              disabled={!isDirty || saving}
            >
              Отменить
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
