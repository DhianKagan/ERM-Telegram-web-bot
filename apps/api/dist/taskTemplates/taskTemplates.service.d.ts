import type { TaskTemplateDocument } from '../db/model';
interface TaskTemplatesRepository {
    createTaskTemplate(data: Partial<TaskTemplateDocument>): Promise<TaskTemplateDocument>;
    listTaskTemplates(): Promise<TaskTemplateDocument[]>;
    getTaskTemplate(id: string): Promise<TaskTemplateDocument | null>;
    deleteTaskTemplate?(id: string): Promise<TaskTemplateDocument | null>;
}
export default class TaskTemplatesService {
    repo: TaskTemplatesRepository;
    constructor(repo: TaskTemplatesRepository);
    create(data: Partial<TaskTemplateDocument>): Promise<TaskTemplateDocument>;
    list(): Promise<TaskTemplateDocument[]>;
    getById(id: string): Promise<TaskTemplateDocument | null>;
    remove(id: string): Promise<TaskTemplateDocument | null> | null;
}
export {};
