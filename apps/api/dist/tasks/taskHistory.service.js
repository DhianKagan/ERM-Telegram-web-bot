"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeAction = describeAction;
// Назначение: формирование текста истории задач для Telegram
// Основные модули: db/model, db/queries, shared, utils/userLink, utils/mdEscape
const shared_1 = require("shared");
const mdEscape_1 = require("../utils/mdEscape");
const emptyObject = Object.freeze({});
const fieldNames = {
    status: 'статус',
    deadline: 'срок',
    due: 'срок',
    completed_at: 'выполнено',
    assignees: 'исполнители',
    description: 'описание',
    title: 'название',
    comment: 'комментарий',
};
const hiddenFields = new Set(['comment']);
const fieldDateFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
});
const numberFormatter = new Intl.NumberFormat('ru-RU');
function parseFixedOffset(label) {
    const normalized = label.trim().toUpperCase();
    const match = /^(?:GMT|UTC)([+-])(\d{1,2})(?::(\d{2}))?$/.exec(normalized);
    if (!match) {
        return null;
    }
    const sign = match[1] === '-' ? -1 : 1;
    const hours = Number.parseInt(match[2], 10);
    const minutes = match[3] ? Number.parseInt(match[3], 10) : 0;
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return null;
    }
    return sign * ((hours * 60 + minutes) * 60 * 1000);
}
const fixedOffsetMs = parseFixedOffset(shared_1.PROJECT_TIMEZONE_LABEL);
function applyFixedOffset(date) {
    if (fixedOffsetMs === null) {
        return date;
    }
    return new Date(date.getTime() + fixedOffsetMs);
}
function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function normalizeForCompare(value) {
    if (value instanceof Date) {
        return value.getTime();
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        const parsed = Date.parse(trimmed);
        if (!Number.isNaN(parsed) && /\d{4}-\d{2}-\d{2}/.test(trimmed)) {
            return new Date(parsed).getTime();
        }
        return trimmed;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (Array.isArray(value)) {
        return value
            .map((item) => normalizeForCompare(item))
            .map((item) => (typeof item === 'string' ? item.trim() : item))
            .sort((a, b) => {
            const left = typeof a === 'string' ? a : JSON.stringify(a);
            const right = typeof b === 'string' ? b : JSON.stringify(b);
            return left.localeCompare(right);
        });
    }
    if (isObject(value)) {
        return Object.keys(value)
            .sort()
            .reduce((acc, key) => {
            acc[key] = normalizeForCompare(value[key]);
            return acc;
        }, {});
    }
    return value !== null && value !== void 0 ? value : null;
}
function formatDate(value) {
    return fieldDateFormatter.format(applyFixedOffset(value)).replace(', ', ' ');
}
function parseDate(value) {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return null;
        const parsed = Date.parse(trimmed);
        if (Number.isNaN(parsed))
            return null;
        return new Date(parsed);
    }
    return null;
}
function formatPrimitiveValue(value) {
    if (value === null || typeof value === 'undefined') {
        return '—';
    }
    if (typeof value === 'boolean') {
        return value ? 'да' : 'нет';
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value))
            return '—';
        return numberFormatter.format(value);
    }
    if (value instanceof Date) {
        return formatDate(value);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return '—';
        const date = parseDate(trimmed);
        if (date) {
            return formatDate(date);
        }
        return trimmed;
    }
    if (Array.isArray(value)) {
        if (!value.length)
            return '—';
        const items = value
            .map((item) => formatPrimitiveValue(item))
            .filter((item) => item && item !== '—');
        if (!items.length)
            return '—';
        return items.join(', ');
    }
    if (isObject(value)) {
        const json = JSON.stringify(value);
        return json ? json : '—';
    }
    return String(value);
}
function formatFieldName(field) {
    var _a;
    const key = field.trim();
    const mapped = (_a = fieldNames[key]) !== null && _a !== void 0 ? _a : key.replace(/_/g, ' ');
    return (0, mdEscape_1.escapeMarkdownV2)(mapped);
}
function formatFieldValue(value, options = {}) {
    const primitive = formatPrimitiveValue(value);
    const escaped = (0, mdEscape_1.escapeMarkdownV2)(primitive);
    const isFormattedDate = primitive
        .split(', ')
        .every((part) => /^\d{2}\.\d{2}\.\d{4}(?: \d{2}:\d{2})?$/.test(part));
    if (isFormattedDate && !options.escapeDatesFully) {
        return escaped.replace(/\\\.(\d{4})(?!\d)/g, '.$1');
    }
    return escaped;
}
function describeAction(entry, options = {}) {
    var _a, _b, _c, _d, _e, _f;
    const to = ((_a = entry.changes) === null || _a === void 0 ? void 0 : _a.to) && isObject((_b = entry.changes) === null || _b === void 0 ? void 0 : _b.to)
        ? (_c = entry.changes) === null || _c === void 0 ? void 0 : _c.to
        : emptyObject;
    const from = ((_d = entry.changes) === null || _d === void 0 ? void 0 : _d.from) && isObject((_e = entry.changes) === null || _e === void 0 ? void 0 : _e.from)
        ? (_f = entry.changes) === null || _f === void 0 ? void 0 : _f.from
        : emptyObject;
    const hasChanges = Object.keys(to).length > 0 || Object.keys(from).length > 0;
    if (!hasChanges) {
        return { kind: 'created', details: 'задача создана' };
    }
    const keys = Array.from(new Set([...Object.keys(from), ...Object.keys(to)])).sort();
    const changedKeys = keys.filter((key) => {
        const nextValue = to[key];
        const prevValue = from[key];
        return (JSON.stringify(normalizeForCompare(nextValue)) !==
            JSON.stringify(normalizeForCompare(prevValue)));
    });
    if (!changedKeys.length) {
        return { kind: 'updated', details: null };
    }
    if (changedKeys.some((key) => hiddenFields.has(key))) {
        return { kind: 'updated', details: null };
    }
    if (changedKeys.includes('status')) {
        const fieldName = formatFieldName('status');
        const previous = formatFieldValue(from.status, options);
        const next = formatFieldValue(to.status, options);
        return {
            kind: 'status',
            details: `${fieldName}: «${previous}» → «${next}»`,
        };
    }
    return { kind: 'updated', details: null };
}
