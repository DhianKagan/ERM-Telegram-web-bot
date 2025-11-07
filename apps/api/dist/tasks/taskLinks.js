"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTaskAppLink = void 0;
// Назначение: построение ссылок на задачи для перехода из Telegram в веб-интерфейс
// Основные модули: config
const config_1 = require("../config");
const APP_URL_BASE = (config_1.appUrl || '').replace(/\/+$/, '');
const toTaskIdentifier = (value) => {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const normalized = String(value).trim();
        return normalized ? normalized : null;
    }
    if (typeof value === 'object' &&
        value !== null &&
        'toString' in value &&
        typeof value.toString === 'function') {
        return toTaskIdentifier(value.toString());
    }
    return null;
};
const buildTaskAppLink = (task) => {
    if (!APP_URL_BASE) {
        return null;
    }
    const canonicalId = toTaskIdentifier(task._id) ??
        toTaskIdentifier(task.request_id) ??
        toTaskIdentifier(task.task_number);
    if (!canonicalId) {
        return null;
    }
    return `${APP_URL_BASE}/tasks?task=${encodeURIComponent(canonicalId)}`;
};
exports.buildTaskAppLink = buildTaskAppLink;
