// Назначение: запросы к API архива задач
// Основные модули: authFetch
import authFetch from '../utils/authFetch';

export interface ArchiveListResult {
  items: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pages: number;
}

export async function fetchArchive(
  params: { page?: number; limit?: number; search?: string } = {},
): Promise<ArchiveListResult> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search.trim());
  const suffix = query.toString();
  const url = suffix ? `/api/v1/archives?${suffix}` : '/api/v1/archives';
  const response = await authFetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Не удалось загрузить архив задач');
  }
  const data = await response.json();
  return {
    items: Array.isArray(data.items) ? data.items : [],
    total: Number(data.total) || 0,
    page: Number(data.page) || 1,
    pages: Number(data.pages) || 0,
  };
}

export async function purgeArchive(ids: string[]): Promise<number> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return 0;
  }
  const response = await authFetch('/api/v1/archives/purge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Не удалось выполнить полное удаление');
  }
  const payload = await response.json();
  return Number(payload.removed) || 0;
}
