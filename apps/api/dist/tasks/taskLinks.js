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
    var _a, _b;
    if (!APP_URL_BASE) {
        return null;
    }
    const canonicalId = (_b = (_a = toTaskIdentifier(task._id)) !== null && _a !== void 0 ? _a : toTaskIdentifier(task.request_id)) !== null && _b !== void 0 ? _b : toTaskIdentifier(task.task_number);
    if (!canonicalId) {
        return null;
    }
    return `${APP_URL_BASE}/tasks?task=${encodeURIComponent(canonicalId)}`;
};
exports.buildTaskAppLink = buildTaskAppLink;
