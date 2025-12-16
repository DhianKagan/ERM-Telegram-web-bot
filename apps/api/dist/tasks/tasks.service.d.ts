import type { TaskDocument } from '../db/model';
import type { TaskFilters, SummaryFilters, TasksChartResult } from '../db/queries';
interface TasksRepository {
    createTask(data: Partial<TaskDocument>, userId?: number): Promise<TaskDocument>;
    getTasks(filters: TaskFilters, page?: number, limit?: number): Promise<{
        tasks: TaskDocument[];
        total: number;
    }>;
    getTask(id: string): Promise<TaskDocument | null>;
    updateTask(id: string, data: Partial<TaskDocument>, userId: number): Promise<TaskDocument | null>;
    addTime(id: string, minutes: number): Promise<TaskDocument | null>;
    bulkUpdate(ids: string[], data: Partial<TaskDocument>): Promise<void>;
    summary(filters: SummaryFilters): Promise<{
        count: number;
        time: number;
    }>;
    chart(filters: SummaryFilters): Promise<TasksChartResult>;
    deleteTask(id: string, actorId?: number): Promise<TaskDocument | null>;
    listMentionedTasks(userId: string | number): Promise<TaskDocument[]>;
}
interface RepositoryWithModel extends TasksRepository {
    Task?: {
        create: (data: Partial<TaskDocument>, userId?: number) => Promise<TaskDocument>;
    };
}
declare class TasksService {
    repo: TasksRepository;
    constructor(repo: RepositoryWithModel);
    private logAttachmentSync;
    create(data?: Partial<TaskDocument>, userId?: number): Promise<TaskDocument>;
    get(filters: TaskFilters, page?: number, limit?: number): Promise<{
        tasks: TaskDocument[];
        total: number;
    }>;
    getById(id: string): Promise<TaskDocument | null>;
    update(id: string, data: Partial<TaskDocument> | undefined, userId: number): Promise<TaskDocument | null>;
    applyCargoMetrics(data?: Partial<TaskDocument>): void;
    private applyGeocoding;
    applyRouteInfo(data?: Partial<TaskDocument>): Promise<void>;
    private applyTaskTypeTopic;
    addTime(id: string, minutes: number): Promise<TaskDocument | null>;
    bulk(ids: string[], data: Partial<TaskDocument>): Promise<void>;
    summary(filters: SummaryFilters): Promise<{
        count: number;
        time: number;
    }>;
    chart(filters: SummaryFilters): Promise<TasksChartResult>;
    remove(id: string, actorId?: number): Promise<TaskDocument | null>;
    mentioned(userId: string): Promise<TaskDocument[]>;
}
export default TasksService;
