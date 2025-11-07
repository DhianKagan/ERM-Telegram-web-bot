import { TaskDocument, TaskAttrs, UserDocument, RoleDocument, RoleAttrs, TaskTemplateDocument, type TaskKind } from './model';
import * as logEngine from '../services/wgLogEngine';
import { Types } from 'mongoose';
export interface UpdateTaskStatusOptions {
    source?: 'web' | 'telegram';
}
export declare function findTaskIdByPublicIdentifier(identifier: string, userId?: number): Promise<Types.ObjectId | null>;
export declare function syncTaskAttachments(taskIdInput: Types.ObjectId | string, attachments: TaskDocument['attachments'] | undefined, userId?: number): Promise<void>;
export declare function accessByRole(role: string): number;
export declare function createTask(data: Partial<TaskDocument>, userId?: number): Promise<TaskDocument>;
export declare function getTask(id: string): Promise<TaskDocument | null>;
export declare function listMentionedTasks(userId: number): Promise<TaskDocument[]>;
export declare function updateTask(id: string, fields: Partial<TaskDocument>, userId: number): Promise<TaskDocument | null>;
export declare function updateTaskStatus(id: string, status: TaskDocument['status'], userId: number, options?: UpdateTaskStatusOptions): Promise<TaskDocument | null>;
export interface TaskFilters {
    status?: string | string[];
    assignees?: (string | number)[];
    from?: string | Date;
    to?: string | Date;
    kanban?: boolean;
    kind?: TaskKind;
    taskType?: string | string[];
}
export declare function getTasks(filters?: TaskFilters, page?: number, limit?: number): Promise<{
    tasks: TaskDocument[];
    total: number;
}>;
export interface RoutesFilters {
    status?: string;
    from?: Date;
    to?: Date;
}
export declare function listRoutes(filters?: RoutesFilters): Promise<TaskDocument[]>;
export declare function searchTasks(text: string): Promise<TaskDocument[]>;
export declare function addTime(id: string, minutes: number, userId?: number): Promise<TaskDocument | null>;
export declare function bulkUpdate(ids: string[], data: Partial<TaskDocument>): Promise<void>;
export declare function deleteTask(id: string, actorId?: number): Promise<TaskDocument | null>;
type LeanArchiveTask = (TaskAttrs & {
    _id: Types.ObjectId;
    archived_at?: Date;
    archived_by?: number;
    createdAt?: Date;
    updatedAt?: Date;
}) & Record<string, unknown>;
export interface ArchiveListParams {
    page?: number;
    limit?: number;
    search?: string;
}
export declare function listArchivedTasks(params?: ArchiveListParams): Promise<{
    items: LeanArchiveTask[];
    total: number;
    page: number;
    pages: number;
}>;
export declare function purgeArchivedTasks(ids: string[]): Promise<number>;
export interface SummaryFilters {
    status?: string;
    assignees?: number[];
    from?: Date;
    to?: Date;
    kind?: TaskKind;
}
export interface TasksChartResult {
    labels: string[];
    data: number[];
}
export declare function tasksChart(filters?: SummaryFilters): Promise<TasksChartResult>;
export declare function summary(filters?: SummaryFilters): Promise<{
    count: number;
    time: number;
}>;
interface GeneratedCredentials {
    telegramId: number;
    username: string;
}
export declare function generateUserCredentials(id?: string | number, username?: string): Promise<GeneratedCredentials>;
export declare function createUser(id: string | number, username?: string, roleId?: string, extra?: Omit<Partial<UserDocument>, 'access' | 'role'>): Promise<UserDocument>;
export declare function getUser(id: string | number): Promise<UserDocument | null>;
export declare function listUsers(): Promise<UserDocument[]>;
export declare function removeUser(id: string | number): Promise<boolean>;
export declare function getUsersMap(ids?: Array<string | number>): Promise<Record<number, UserDocument>>;
export declare function updateUser(id: string | number, data: Omit<Partial<UserDocument>, 'access'>): Promise<UserDocument | null>;
export interface RoleWithAccess extends RoleAttrs {
    _id: Types.ObjectId;
    access: number;
}
export declare function listRoles(): Promise<RoleWithAccess[]>;
export declare function getRole(id: string): Promise<RoleDocument | null>;
export declare function updateRole(id: string, permissions: Array<string | number>): Promise<RoleDocument | null>;
export declare function createTaskTemplate(data: Partial<TaskTemplateDocument>): Promise<TaskTemplateDocument>;
export declare function getTaskTemplate(id: string): Promise<TaskTemplateDocument | null>;
export declare function listTaskTemplates(): Promise<TaskTemplateDocument[]>;
export declare function deleteTaskTemplate(id: string): Promise<TaskTemplateDocument | null>;
declare const _default: {
    createTask: typeof createTask;
    listMentionedTasks: typeof listMentionedTasks;
    updateTask: typeof updateTask;
    updateTaskStatus: typeof updateTaskStatus;
    getTask: typeof getTask;
    getTasks: typeof getTasks;
    addTime: typeof addTime;
    bulkUpdate: typeof bulkUpdate;
    deleteTask: typeof deleteTask;
    summary: typeof summary;
    chart: typeof tasksChart;
    tasksChart: typeof tasksChart;
    createUser: typeof createUser;
    generateUserCredentials: typeof generateUserCredentials;
    getUser: typeof getUser;
    listUsers: typeof listUsers;
    removeUser: typeof removeUser;
    getUsersMap: typeof getUsersMap;
    updateUser: typeof updateUser;
    listRoles: typeof listRoles;
    getRole: typeof getRole;
    updateRole: typeof updateRole;
    writeLog: (message: string, level?: string, metadata?: Record<string, unknown>) => Promise<void>;
    listLogs: (params?: logEngine.ListLogParams) => Promise<logEngine.BufferedLogEntry[]>;
    searchTasks: typeof searchTasks;
    createTaskTemplate: typeof createTaskTemplate;
    getTaskTemplate: typeof getTaskTemplate;
    listTaskTemplates: typeof listTaskTemplates;
    deleteTaskTemplate: typeof deleteTaskTemplate;
    listRoutes: typeof listRoutes;
    listArchivedTasks: typeof listArchivedTasks;
    purgeArchivedTasks: typeof purgeArchivedTasks;
};
export default _default;
