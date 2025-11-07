"use strict";
// Назначение: единый набор значков для статусов задач
// Основные модули: shared
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTaskStatusIcon = exports.TASK_STATUS_ICON_MAP = void 0;
exports.TASK_STATUS_ICON_MAP = {
    Новая: '🆕',
    'В работе': '🟢',
    Выполнена: '✅',
    Отменена: '⛔️',
};
const getTaskStatusIcon = (status) => {
    if (!status) {
        return null;
    }
    return exports.TASK_STATUS_ICON_MAP[status] ?? null;
};
exports.getTaskStatusIcon = getTaskStatusIcon;
