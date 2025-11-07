import { Context } from 'telegraf';
/** Возвращает статус участника чата по его Telegram ID. */
export declare function getMemberStatus(id: number): Promise<string>;
/** Извлекает Telegram ID из контекста сообщения. */
export declare function getTelegramId(ctx: Context): number | undefined;
