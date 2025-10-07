// Назначение: работа с настройками задач в панели управления
// Основные модули: authFetch, shared типы
import type {
  TaskSettingsResponse,
  TaskFieldDisplaySetting,
  TaskTypeSetting,
} from 'shared';
import authFetch from '../utils/authFetch';

export const fetchTaskSettings = async (): Promise<TaskSettingsResponse> => {
  const response = await authFetch('/api/v1/task-settings');
  if (!response.ok) {
    throw new Error('Не удалось загрузить настройки задач');
  }
  const data = (await response.json()) as TaskSettingsResponse;
  return data;
};

export const updateTaskFieldLabel = async (
  name: string,
  label: string,
): Promise<TaskFieldDisplaySetting> => {
  const response = await authFetch(`/api/v1/task-settings/fields/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || 'Не удалось сохранить название поля');
  }
  return (await response.json()) as TaskFieldDisplaySetting;
};

export const updateTaskTypeSettings = async (
  name: string,
  payload: { label: string; tg_theme_url?: string | null },
): Promise<TaskTypeSetting> => {
  const response = await authFetch(`/api/v1/task-settings/types/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || 'Не удалось сохранить настройки типа задачи');
  }
  return (await response.json()) as TaskTypeSetting;
};

export default {
  fetchTaskSettings,
  updateTaskFieldLabel,
  updateTaskTypeSettings,
};
