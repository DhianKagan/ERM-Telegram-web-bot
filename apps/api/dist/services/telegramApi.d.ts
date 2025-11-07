export interface TelegramResponse<T> {
    ok: boolean;
    result: T;
    description?: string;
}
/**
 * Вызов метода Telegram API с повторными попытками
 */
export declare function call<T = unknown>(method: string, params?: Record<string, unknown>, attempt?: number): Promise<T>;
