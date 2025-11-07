"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeUserId = normalizeUserId;
exports.collectAssigneeIds = collectAssigneeIds;
// Назначение: нормализация идентификаторов исполнителей задач
// Основные модули: отсутствуют
const NESTED_ID_KEYS = ['telegram_id', 'user_id', 'id'];
const isRecord = (value) => typeof value === 'object' && value !== null;
const tryNormalizeFromRecord = (record) => {
    for (const key of NESTED_ID_KEYS) {
        if (key in record) {
            const nested = normalizeUserId(record[key]);
            if (nested !== null) {
                return nested;
            }
        }
    }
    return null;
};
function normalizeUserId(value) {
    if (isRecord(value)) {
        const nested = tryNormalizeFromRecord(value);
        if (nested !== null) {
            return nested;
        }
    }
    const source = typeof value === 'string' ? value.trim() : value;
    const numeric = Number(source);
    if (!Number.isFinite(numeric) || numeric === 0) {
        return null;
    }
    return numeric;
}
function collectAssigneeIds(source) {
    if (!Array.isArray(source)) {
        return [];
    }
    const ids = new Set();
    for (const entry of source) {
        if (entry == null) {
            continue;
        }
        if (isRecord(entry)) {
            const nested = tryNormalizeFromRecord(entry);
            if (nested !== null) {
                ids.add(nested);
                continue;
            }
        }
        const normalized = normalizeUserId(entry);
        if (normalized !== null) {
            ids.add(normalized);
        }
    }
    return Array.from(ids);
}
