/**
 * Назначение файла: очередь вызовов Telegram API с ограничением объёма.
 * Основные модули: Promise, setInterval.
 */
interface QueueItem<T> {
    fn: () => Promise<T> | T;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
}
export declare const queue: QueueItem<unknown>[];
export declare const MAX_QUEUE_SIZE = 100;
export declare function startQueue(): void;
export declare function stopQueue(): void;
export declare function enqueue<T>(fn: () => Promise<T> | T): Promise<T>;
export {};
