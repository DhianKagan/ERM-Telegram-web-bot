// Сервис шаблонов задач
// Основные модули: db/queries
import type { TaskTemplateDocument } from '../db/model';

interface TaskTemplatesRepository {
  createTaskTemplate(
    data: Partial<TaskTemplateDocument>,
  ): Promise<TaskTemplateDocument>;
  listTaskTemplates(userId: number): Promise<TaskTemplateDocument[]>;
  getTaskTemplate(
    id: string,
    userId: number,
  ): Promise<TaskTemplateDocument | null>;
  deleteTaskTemplate(
    id: string,
    userId: number,
  ): Promise<TaskTemplateDocument | null>;
}

export default class TaskTemplatesService {
  repo: TaskTemplatesRepository;
  constructor(repo: TaskTemplatesRepository) {
    this.repo = repo;
  }

  create(data: Partial<TaskTemplateDocument>) {
    return this.repo.createTaskTemplate(data);
  }

  list(userId: number) {
    return this.repo.listTaskTemplates(userId);
  }

  getById(id: string, userId: number) {
    return this.repo.getTaskTemplate(id, userId);
  }

  remove(id: string, userId: number) {
    return this.repo.deleteTaskTemplate(id, userId);
  }
}
