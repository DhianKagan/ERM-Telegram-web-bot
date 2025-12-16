"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTaskIdentifier = getTaskIdentifier;
exports.buildActionMessage = buildActionMessage;
exports.buildLatestHistorySummary = buildLatestHistorySummary;
exports.buildHistorySummaryLog = buildHistorySummaryLog;
// Назначение: функции формирования текстов для уведомлений о задачах
// Основные модули: shared, db/model, db/queries
const shared_1 = require("shared");
const queries_1 = require("../db/queries");
const taskEventFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: shared_1.PROJECT_TIMEZONE,
});
const formatAuthorText = (profile, userId) => {
    var _a, _b;
    if (!profile) {
        return `пользователем #${userId}`;
    }
    const name = (_a = profile.name) === null || _a === void 0 ? void 0 : _a.trim();
    if (name) {
        return `пользователем ${name}`;
    }
    const username = (_b = profile.username) === null || _b === void 0 ? void 0 : _b.trim();
    if (username) {
        return `пользователем ${username}`;
    }
    return `пользователем #${userId}`;
};
const trimString = (value) => {
    if (value === undefined || value === null)
        return null;
    const str = String(value).trim();
    return str ? str : null;
};
const resolveIdentifier = (value) => {
    var _a;
    if (typeof value === 'string' || typeof value === 'number') {
        return trimString(value);
    }
    if (value && typeof value === 'object' && 'toString' in value) {
        const candidate = String((_a = value.toString()) !== null && _a !== void 0 ? _a : '');
        return candidate.trim() ? candidate.trim() : null;
    }
    return null;
};
const extractStatus = (value) => {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const record = value;
    return trimString(record.status);
};
function getTaskIdentifier(task) {
    return (resolveIdentifier(task.request_id) ||
        resolveIdentifier(task.task_number) ||
        resolveIdentifier(task._id) ||
        '');
}
async function buildActionMessage(task, action, at, creatorId) {
    const identifier = getTaskIdentifier(task);
    const formatted = taskEventFormatter.format(at).replace(', ', ' ');
    const creator = Number(creatorId);
    let authorText = 'неизвестным пользователем';
    if (Number.isFinite(creator) && creator !== 0) {
        try {
            const users = await (0, queries_1.getUsersMap)([creator]);
            const profile = users === null || users === void 0 ? void 0 : users[creator];
            authorText = formatAuthorText(profile, creator);
        }
        catch (error) {
            console.error('Не удалось получить автора задачи', error);
            authorText = `пользователем #${creator}`;
        }
    }
    return `Задача ${identifier} ${action} ${authorText} ${formatted} (${shared_1.PROJECT_TIMEZONE_LABEL})`;
}
const resolveHistoryAction = (entry) => {
    var _a, _b;
    if (!entry)
        return null;
    const toStatus = extractStatus((_a = entry.changes) === null || _a === void 0 ? void 0 : _a.to);
    const fromStatus = extractStatus((_b = entry.changes) === null || _b === void 0 ? void 0 : _b.from);
    if (toStatus && toStatus !== fromStatus) {
        return `переведена в статус «${toStatus}»`;
    }
    if (!toStatus && fromStatus && fromStatus !== toStatus) {
        return 'переведена в статус «без статуса»';
    }
    return null;
};
const shouldSkipInitialStatusEntry = (entries, index) => {
    var _a, _b;
    if (index !== 0) {
        return false;
    }
    const entry = entries[index];
    if (!entry) {
        return false;
    }
    const toStatus = extractStatus((_a = entry.changes) === null || _a === void 0 ? void 0 : _a.to);
    if (!toStatus) {
        return false;
    }
    const fromStatus = extractStatus((_b = entry.changes) === null || _b === void 0 ? void 0 : _b.from);
    return !fromStatus;
};
async function buildLatestHistorySummary(task) {
    const history = Array.isArray(task.history) ? task.history : [];
    if (!history.length) {
        return null;
    }
    const latest = history[history.length - 1];
    if (shouldSkipInitialStatusEntry(history, history.length - 1)) {
        return null;
    }
    const action = resolveHistoryAction(latest);
    if (!action) {
        return null;
    }
    const changedAt = latest.changed_at instanceof Date
        ? latest.changed_at
        : latest.changed_at
            ? new Date(latest.changed_at)
            : new Date();
    if (Number.isNaN(changedAt.getTime())) {
        return null;
    }
    const changedBy = Number(latest.changed_by);
    return buildActionMessage(task, action, changedAt, Number.isFinite(changedBy) ? changedBy : undefined);
}
async function buildHistorySummaryLog(task) {
    const history = Array.isArray(task.history) ? task.history : [];
    if (!history.length) {
        return null;
    }
    const identifier = getTaskIdentifier(task);
    const userIds = new Set();
    history.forEach((entry) => {
        const changedBy = Number(entry.changed_by);
        if (Number.isFinite(changedBy) && changedBy !== 0) {
            userIds.add(changedBy);
        }
    });
    let userProfiles = {};
    if (userIds.size) {
        try {
            const users = await (0, queries_1.getUsersMap)(Array.from(userIds));
            Object.entries(users || {}).forEach(([key, value]) => {
                const numericId = Number(key);
                if (Number.isFinite(numericId)) {
                    userProfiles[numericId] = {
                        name: value === null || value === void 0 ? void 0 : value.name,
                        username: value === null || value === void 0 ? void 0 : value.username,
                    };
                }
            });
        }
        catch (error) {
            console.error('Не удалось получить авторов истории задачи', error);
        }
    }
    const lines = history
        .map((entry, index) => {
        if (shouldSkipInitialStatusEntry(history, index)) {
            return null;
        }
        const action = resolveHistoryAction(entry);
        if (!action) {
            return null;
        }
        const changedAt = entry.changed_at instanceof Date
            ? entry.changed_at
            : entry.changed_at
                ? new Date(entry.changed_at)
                : new Date();
        if (Number.isNaN(changedAt.getTime())) {
            return null;
        }
        const formatted = taskEventFormatter.format(changedAt).replace(', ', ' ');
        const changedBy = Number(entry.changed_by);
        let authorText = 'неизвестным пользователем';
        if (Number.isFinite(changedBy) && changedBy !== 0) {
            authorText = formatAuthorText(userProfiles[changedBy], changedBy);
        }
        return `Задача ${identifier} ${action} ${authorText} ${formatted} (${shared_1.PROJECT_TIMEZONE_LABEL})`;
    })
        .filter((line) => Boolean(line));
    if (!lines.length) {
        return null;
    }
    return lines.join('\n');
}
