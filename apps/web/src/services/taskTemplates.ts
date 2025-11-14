// Назначение: клиентские запросы к API шаблонов задач
// Основные модули: authFetch
import authFetch from '../utils/authFetch';

export interface TaskTemplate {
  _id: string;
  name: string;
  data: Record<string, unknown>;
}

export interface CreateTaskTemplatePayload {
  name: string;
  data: Record<string, unknown>;
}

const normalizeTemplate = (candidate: unknown): TaskTemplate | null => {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }
  const record = candidate as Record<string, unknown>;
  const idRaw = record._id;
  const nameRaw = record.name;
  if (typeof idRaw !== 'string' || !idRaw.trim()) {
    return null;
  }
  if (typeof nameRaw !== 'string' || !nameRaw.trim()) {
    return null;
  }
  const dataRaw = record.data;
  const data =
    dataRaw && typeof dataRaw === 'object'
      ? (dataRaw as Record<string, unknown>)
      : {};
  return {
    _id: idRaw,
    name: nameRaw,
    data,
  };
};

export const list = async (): Promise<TaskTemplate[]> => {
  const response = await authFetch('/api/v1/task-templates');
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body.trim() || 'Не удалось загрузить шаблоны задач');
  }
  const raw = await response.json().catch(() => []);
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item) => normalizeTemplate(item))
    .filter((item): item is TaskTemplate => Boolean(item));
};

export const create = async (
  payload: CreateTaskTemplatePayload,
): Promise<TaskTemplate> => {
  const response = await authFetch('/api/v1/task-templates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body.trim() || 'Не удалось сохранить шаблон задачи');
  }
  const raw = await response.json().catch(() => ({}));
  const normalized = normalizeTemplate(raw);
  if (!normalized) {
    throw new Error('Сервер вернул некорректный шаблон задачи');
  }
  return normalized;
};

export default { list, create };
