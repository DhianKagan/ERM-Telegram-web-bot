import 'dotenv/config';
import { Telegraf, Markup, Context } from 'telegraf';
import '../db/model';
import type { Task as SharedTask } from 'shared';
export declare const bot: Telegraf<Context>;
declare function handleReportCommand(ctx: Context): Promise<void>;
export { buildTaskAppLink } from '../tasks/taskLinks';
export type TaskUserProfile = {
    name: string;
    username: string;
    isBot: boolean;
};
export declare const buildDirectTaskMessage: (task: Record<string, unknown> & {
    status?: SharedTask["status"];
}, link: string | null, users: Record<number, TaskUserProfile>, appLink?: string | null, options?: {
    note?: string | null;
}) => string;
export declare const buildDirectTaskKeyboard: (link: string | null | undefined, appLink?: string | null | undefined) => ReturnType<typeof Markup.inlineKeyboard> | undefined;
declare function processStatusAction(ctx: Context, status: 'В работе' | 'Выполнена' | 'Отменена', responseMessage: string): Promise<void>;
export declare function startBot(retry?: number): Promise<void>;
export declare const __resetCloseThrottleForTests: () => Promise<void>;
export { processStatusAction };
export { handleReportCommand };
