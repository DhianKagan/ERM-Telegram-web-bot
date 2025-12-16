import type { Task } from 'shared';
type TaskStatus = Task['status'];
export declare const TASK_STATUS_ICON_MAP: Record<TaskStatus, string>;
export declare const getTaskStatusIcon: (status: TaskStatus | undefined | null) => string | null;
export {};
