"use strict";
/**
 * Назначение файла: очередь вызовов Telegram API с ограничением объёма.
 * Основные модули: Promise, setInterval.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_QUEUE_SIZE = exports.queue = void 0;
exports.startQueue = startQueue;
exports.stopQueue = stopQueue;
exports.enqueue = enqueue;
exports.queue = [];
exports.MAX_QUEUE_SIZE = 100;
let tokens = 30;
let timer;
function processQueue() {
    while (tokens > 0 && exports.queue.length) {
        tokens--;
        const { fn, resolve, reject } = exports.queue.shift();
        Promise.resolve()
            .then(fn)
            .then(resolve)
            .catch((e) => {
            console.error('Ошибка очереди', e);
            reject(e);
        });
    }
}
function startQueue() {
    if (!timer) {
        timer = setInterval(() => {
            tokens = 30;
            processQueue();
        }, 1000);
    }
}
if (process.env.NODE_ENV !== 'test') {
    startQueue();
}
function stopQueue() {
    if (timer) {
        clearInterval(timer);
        timer = undefined;
    }
}
function enqueue(fn) {
    return new Promise((resolve, reject) => {
        if (exports.queue.length >= exports.MAX_QUEUE_SIZE) {
            console.error('Превышен лимит очереди');
            reject(new Error('queue overflow'));
            return;
        }
        exports.queue.push({
            fn: fn,
            resolve: resolve,
            reject,
        });
        processQueue();
    });
}
