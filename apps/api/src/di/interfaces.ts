// Назначение файла: интерфейсы сервисов для DI
// Основные модули: db/queries, services, models
import type { TaskDocument } from '../db/model';
import type { TaskFilters, SummaryFilters } from '../db/queries';

export interface ITasksService {
  get(
    filters: TaskFilters,
    page?: number,
    limit?: number,
  ): Promise<TaskDocument[]>;
  getById(id: string): Promise<TaskDocument | null>;
  create(data: Partial<TaskDocument>): Promise<TaskDocument>;
  update(id: string, data: Partial<TaskDocument>): Promise<TaskDocument | null>;
  addTime(id: string, minutes: number): Promise<TaskDocument | null>;
  bulk(ids: string[], data: Partial<TaskDocument>): Promise<void>;
  mentioned(userId: string): Promise<TaskDocument[]>;
  summary(filters: SummaryFilters): Promise<{ count: number; time: number }>;
  remove(id: string): Promise<TaskDocument | null>;
}

export interface IUsersService {
  list(): Promise<unknown[]>;
  create(id: string, username?: string, data?: unknown): Promise<unknown>;
  update(id: string, data: unknown): Promise<unknown | null>;
}

export interface IRolesService {
  list(): Promise<unknown[]>;
  update(id: string, permissions: string[]): Promise<unknown | null>;
}

export interface ILogsService {
  list(params: unknown): Promise<unknown[]>;
  write(message: string): Promise<void>;
}
