// Сервис шаблонов задач
// Основные модули: db/queries
import type { TaskTemplateDocument } from '../db/model';

interface TaskTemplatesRepository {
  createTaskTemplate(
    data: Partial<TaskTemplateDocument>,
  ): Promise<TaskTemplateDocument>;
  listTaskTemplates(): Promise<TaskTemplateDocument[]>;
  getTaskTemplate(id: string): Promise<TaskTemplateDocument | null>;
  deleteTaskTemplate?(id: string): Promise<TaskTemplateDocument | null>;
}

export default class TaskTemplatesService {
  repo: TaskTemplatesRepository;
  constructor(repo: TaskTemplatesRepository) {
    this.repo = repo;
  }

  create(data: Partial<TaskTemplateDocument>) {
    return this.repo.createTaskTemplate(data);
  }

  list() {
    return this.repo.listTaskTemplates();
  }

  getById(id: string) {
    return this.repo.getTaskTemplate(id);
  }

  remove(id: string) {
    return this.repo.deleteTaskTemplate?.(id) || null;
  }
}
