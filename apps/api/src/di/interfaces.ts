// Назначение файла: интерфейсы сервисов для DI
// Основные модули: db/queries, services, models
import type { TaskDocument } from '../db/model';
import type {
  TaskFilters,
  SummaryFilters,
  TasksChartResult,
} from '../db/queries';

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
  chart(filters: SummaryFilters): Promise<TasksChartResult>;
  remove(id: string): Promise<TaskDocument | null>;
}

export interface IUsersService {
  list(): Promise<unknown[]>;
  create(
    id: string | number | undefined,
    username?: string,
    roleId?: string,
    data?: unknown,
  ): Promise<unknown>;
  generate(
    id?: string | number,
    username?: string,
  ): Promise<{ telegramId: number; username: string }>;
  get(id: string | number): Promise<unknown | null>;
  update(id: string, data: unknown): Promise<unknown | null>;
  remove(id: string | number): Promise<boolean>;
}

export interface IRolesService {
  list(): Promise<unknown[]>;
  update(id: string, permissions: string[]): Promise<unknown | null>;
}

export interface ILogsService {
  list(params: unknown): Promise<unknown[]>;
  write(message: string): Promise<void>;
}
