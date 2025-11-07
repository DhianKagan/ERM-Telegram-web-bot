import 'reflect-metadata';
import type { Context, Telegraf } from 'telegraf';
import type { TaskDocument } from '../db/model';
type PlainTask = TaskDocument & Record<string, unknown>;
export default class TaskSyncController {
    private readonly bot;
    private readonly mediaHelper;
    constructor(bot: Telegraf<Context>);
    onWebTaskUpdate(taskId: string, override?: TaskDocument | (TaskDocument & Record<string, unknown>) | null): Promise<void>;
    onTelegramAction(taskId: string, status: TaskDocument['status'], userId: number): Promise<PlainTask | null>;
    syncAfterChange(taskId: string, override?: TaskDocument | (TaskDocument & Record<string, unknown>) | null): Promise<void>;
    private updateTaskMessage;
}
export {};
