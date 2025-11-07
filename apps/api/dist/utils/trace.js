"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWithTrace = runWithTrace;
exports.getTrace = getTrace;
// Назначение: управление контекстом трассировки
// Основные модули: AsyncLocalStorage
const async_hooks_1 = require("async_hooks");
const storage = new async_hooks_1.AsyncLocalStorage();
function runWithTrace(store, fn) {
    return storage.run(store, fn);
}
function getTrace() {
    return storage.getStore();
}
