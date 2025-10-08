// Назначение: типы архивных задач на фронтенде
// Основные модули: отсутствуют
export interface ArchiveTask {
  id: string;
  task_number?: string;
  title?: string;
  status?: string;
  archived_at?: string;
  createdAt?: string;
  archived_by?: number;
  [key: string]: unknown;
}
