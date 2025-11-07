"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseStringList = parseStringList;
exports.parseAssigneeList = parseAssigneeList;
exports.normalizeTaskFilters = normalizeTaskFilters;
function parseStringList(value) {
    if (Array.isArray(value)) {
        return value
            .flatMap((item) => parseStringList(item))
            .filter((item) => typeof item === 'string' && item.length > 0);
    }
    if (typeof value === 'string') {
        return value
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
    }
    return [];
}
function parseAssigneeList(value) {
    const result = new Set();
    const addValue = (raw) => {
        if (typeof raw === 'number' && Number.isFinite(raw)) {
            result.add(raw);
            return;
        }
        parseStringList(raw).forEach((item) => {
            const parsed = Number(item);
            if (Number.isFinite(parsed)) {
                result.add(parsed);
            }
        });
    };
    if (Array.isArray(value)) {
        value.forEach(addValue);
    }
    else if (value !== undefined && value !== null) {
        addValue(value);
    }
    return Array.from(result.values());
}
function normalizeTaskFilters(filters) {
    const statusValues = parseStringList(filters.status);
    const taskTypeValues = parseStringList(filters.taskType !== undefined ? filters.taskType : filters.type);
    const assigneeCandidates = [
        ...parseAssigneeList(filters.assignees),
        ...parseAssigneeList(filters.assignee),
    ];
    const assigneeValues = Array.from(new Set(assigneeCandidates));
    const normalized = {};
    let kindFilter;
    if (typeof filters.kind === 'string') {
        const trimmed = filters.kind.trim();
        if (trimmed === 'task' || trimmed === 'request') {
            normalized.kind = trimmed;
            kindFilter = trimmed;
        }
    }
    if (typeof filters.from === 'string' && filters.from.trim().length > 0) {
        normalized.from = filters.from;
    }
    if (typeof filters.to === 'string' && filters.to.trim().length > 0) {
        normalized.to = filters.to;
    }
    const kanbanValue = Array.isArray(filters.kanban)
        ? filters.kanban[0]
        : filters.kanban;
    if (typeof kanbanValue === 'boolean') {
        normalized.kanban = kanbanValue;
    }
    else if (typeof kanbanValue === 'string') {
        const normalizedValue = kanbanValue.trim().toLowerCase();
        normalized.kanban = normalizedValue === 'true' || normalizedValue === '1';
    }
    if (statusValues.length === 1) {
        [normalized.status] = statusValues;
    }
    else if (statusValues.length > 1) {
        normalized.status = statusValues;
    }
    if (taskTypeValues.length === 1) {
        [normalized.taskType] = taskTypeValues;
    }
    else if (taskTypeValues.length > 1) {
        normalized.taskType = taskTypeValues;
    }
    if (assigneeValues.length > 0) {
        normalized.assignees = assigneeValues;
    }
    return {
        normalized,
        statusValues,
        taskTypeValues,
        assigneeValues,
        kindFilter,
    };
}
