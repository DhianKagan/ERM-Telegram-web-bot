import { Markup } from 'telegraf';
import type { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
type TaskStatus = 'Новая' | 'В работе' | 'Выполнена' | 'Отменена';
export interface TaskStatusKeyboardOptions {
    kind?: 'task' | 'request';
}
export interface TaskStatusKeyboardExtras {
    albumLink?: string;
    showCommentButton?: boolean;
}
export declare function taskAcceptConfirmKeyboard(id: string): ReturnType<typeof Markup.inlineKeyboard>;
export declare function taskDoneConfirmKeyboard(id: string): ReturnType<typeof Markup.inlineKeyboard>;
export declare function taskCancelConfirmKeyboard(id: string): ReturnType<typeof Markup.inlineKeyboard>;
export default function taskStatusKeyboard(id: string, currentStatus?: TaskStatus, options?: TaskStatusKeyboardOptions, extras?: TaskStatusKeyboardExtras): ReturnType<typeof Markup.inlineKeyboard>;
export declare function taskStatusInlineMarkup(id: string, currentStatus?: TaskStatus, options?: TaskStatusKeyboardOptions, extras?: TaskStatusKeyboardExtras): InlineKeyboardMarkup;
export {};
