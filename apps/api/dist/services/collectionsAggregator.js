"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCollectionsWithLegacy = listCollectionsWithLegacy;
const shared_1 = require("shared");
const CollectionItem_1 = require("../db/models/CollectionItem");
const department_1 = require("../db/models/department");
const employee_1 = require("../db/models/employee");
const telegramTopics_1 = require("../utils/telegramTopics");
const SUPPORTED_LEGACY_TYPES = new Set(['departments', 'employees']);
const TASK_TYPE_ORDER = new Map(shared_1.TASK_TYPES.map((value, index) => [value, index]));
const toStringId = (value) => String(value);
const normalizeMeta = (meta) => (meta ? { ...meta } : undefined);
const mapCollectionItem = (doc) => ({
    _id: toStringId(doc._id),
    type: doc.type,
    name: doc.name,
    value: doc.value,
    meta: normalizeMeta(doc.meta),
});
const mapDepartment = (doc) => ({
    _id: toStringId(doc._id),
    type: 'departments',
    name: doc.name,
    value: '',
    meta: {
        legacy: true,
        readonly: true,
        source: 'departments',
        readonlyReason: 'Элемент перенесён из коллекции Department и доступен только для чтения.',
        sourceId: toStringId(doc._id),
        fleetId: doc.fleetId ? toStringId(doc.fleetId) : undefined,
    },
});
const mapEmployee = (doc) => ({
    _id: toStringId(doc._id),
    type: 'employees',
    name: doc.name,
    value: '',
    meta: {
        legacy: true,
        readonly: true,
        source: 'employees',
        readonlyReason: 'Сотрудник хранится в коллекции Employee и доступен только для чтения.',
        sourceId: toStringId(doc._id),
        departmentId: doc.departmentId ? toStringId(doc.departmentId) : undefined,
        divisionId: doc.divisionId ? toStringId(doc.divisionId) : undefined,
        positionId: doc.positionId ? toStringId(doc.positionId) : undefined,
    },
});
const shouldIncludeLegacyType = (type) => !type || SUPPORTED_LEGACY_TYPES.has(type);
const applyTaskFieldDefaults = (item, order, defaults) => {
    const meta = item.meta ?? {};
    item.meta = {
        ...meta,
        order,
        defaultLabel: defaults.label,
        fieldType: defaults.type,
        required: Boolean(defaults.required),
        virtual: Boolean(meta.virtual),
    };
    if (!item.value) {
        item.value = defaults.label;
    }
};
const applyTaskTypeDefaults = (item, order) => {
    const meta = item.meta ?? {};
    const url = typeof meta.tg_theme_url === 'string' ? meta.tg_theme_url.trim() : '';
    const parsed = url ? (0, telegramTopics_1.parseTelegramTopicUrl)(url) : null;
    const photosUrl = typeof meta.tg_photos_url === 'string' ? meta.tg_photos_url.trim() : '';
    const photosParsed = photosUrl ? (0, telegramTopics_1.parseTelegramTopicUrl)(photosUrl) : null;
    item.meta = {
        ...meta,
        order,
        defaultLabel: item.name,
        tg_theme_url: url || undefined,
        tg_chat_id: parsed?.chatId,
        tg_topic_id: parsed?.topicId,
        tg_photos_url: photosUrl || undefined,
        tg_photos_chat_id: photosParsed?.chatId,
        tg_photos_topic_id: photosParsed?.topicId,
        virtual: Boolean(meta.virtual),
    };
    if (!item.value) {
        item.value = item.name;
    }
};
const ensureTaskFieldItems = (items) => {
    const existing = new Map();
    items
        .filter((item) => item.type === 'task_fields')
        .forEach((item) => {
        existing.set(item.name, item);
    });
    shared_1.taskFields.forEach((field, index) => {
        const target = existing.get(field.name);
        if (target) {
            applyTaskFieldDefaults(target, index, field);
            return;
        }
        const virtual = {
            _id: `virtual:task_field:${field.name}`,
            type: 'task_fields',
            name: field.name,
            value: field.label,
            meta: {
                order: index,
                defaultLabel: field.label,
                fieldType: field.type,
                required: Boolean(field.required),
                virtual: true,
            },
        };
        items.push(virtual);
    });
};
const ensureTaskTypeItems = (items) => {
    const existing = new Map();
    items
        .filter((item) => item.type === 'task_types')
        .forEach((item) => {
        existing.set(item.name, item);
    });
    shared_1.TASK_TYPES.forEach((typeName, index) => {
        const target = existing.get(typeName);
        if (target) {
            applyTaskTypeDefaults(target, index);
            return;
        }
        const virtual = {
            _id: `virtual:task_type:${typeName}`,
            type: 'task_types',
            name: typeName,
            value: typeName,
            meta: {
                order: index,
                defaultLabel: typeName,
                tg_theme_url: undefined,
                tg_chat_id: undefined,
                tg_topic_id: undefined,
                tg_photos_url: undefined,
                tg_photos_chat_id: undefined,
                tg_photos_topic_id: undefined,
                virtual: true,
            },
        };
        items.push(virtual);
    });
    items
        .filter((item) => item.type === 'task_types')
        .forEach((item) => {
        const order = TASK_TYPE_ORDER.get(item.name) ?? shared_1.TASK_TYPES.length;
        applyTaskTypeDefaults(item, order);
    });
};
const compareByOrder = (a, b) => {
    const left = typeof a === 'number' ? a : Number.POSITIVE_INFINITY;
    const right = typeof b === 'number' ? b : Number.POSITIVE_INFINITY;
    if (left === right) {
        return 0;
    }
    return left < right ? -1 : 1;
};
const matchesFilters = (item, filters) => {
    if (filters.type && item.type !== filters.type)
        return false;
    if (filters.name && item.name !== filters.name)
        return false;
    if (filters.value && item.value !== filters.value)
        return false;
    if (filters.search) {
        const term = filters.search.trim().toLowerCase();
        const haystack = `${item.name} ${item.value}`.toLowerCase();
        if (!haystack.includes(term))
            return false;
    }
    return true;
};
const paginate = (items, page, limit) => {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20;
    const start = (safePage - 1) * safeLimit;
    const end = start + safeLimit;
    return items.slice(start, end);
};
async function listCollectionsWithLegacy(filters = {}, page = 1, limit = 20) {
    const baseQuery = {};
    if (filters.type)
        baseQuery.type = filters.type;
    if (filters.name)
        baseQuery.name = filters.name;
    if (filters.value)
        baseQuery.value = filters.value;
    const baseItemsRaw = (await CollectionItem_1.CollectionItem.find(baseQuery).lean());
    const items = baseItemsRaw.map(mapCollectionItem);
    const typeFilter = filters.type;
    const byTypeName = new Map();
    const byTypeId = new Map();
    items.forEach((item) => {
        if (!byTypeName.has(item.type)) {
            byTypeName.set(item.type, new Set());
        }
        if (!byTypeId.has(item.type)) {
            byTypeId.set(item.type, new Set());
        }
        byTypeName.get(item.type)?.add(item.name);
        byTypeId.get(item.type)?.add(item._id);
    });
    if (!typeFilter || typeFilter === 'task_fields') {
        ensureTaskFieldItems(items);
    }
    if (!typeFilter || typeFilter === 'task_types') {
        ensureTaskTypeItems(items);
    }
    if (shouldIncludeLegacyType(typeFilter)) {
        if (!typeFilter || typeFilter === 'departments') {
            const departmentsRaw = (await department_1.Department.find().lean());
            const existingNames = byTypeName.get('departments') ?? new Set();
            const existingIds = byTypeId.get('departments') ?? new Set();
            departmentsRaw.forEach((dept) => {
                const name = dept.name;
                const id = toStringId(dept._id);
                if (existingNames.has(name) || existingIds.has(id))
                    return;
                items.push(mapDepartment(dept));
                existingNames.add(name);
                existingIds.add(id);
            });
        }
        if (!typeFilter || typeFilter === 'employees') {
            const employeesRaw = (await employee_1.Employee.find().lean());
            const existingNames = byTypeName.get('employees') ?? new Set();
            const existingIds = byTypeId.get('employees') ?? new Set();
            employeesRaw.forEach((emp) => {
                const name = emp.name;
                const id = toStringId(emp._id);
                if (existingNames.has(name) || existingIds.has(id))
                    return;
                items.push(mapEmployee(emp));
                existingNames.add(name);
                existingIds.add(id);
            });
        }
    }
    const filtered = items
        .filter((item) => matchesFilters(item, filters))
        .sort((a, b) => {
        if (a.type === 'task_fields' && b.type === 'task_fields') {
            return compareByOrder(a.meta?.order, b.meta?.order);
        }
        if (a.type === 'task_types' && b.type === 'task_types') {
            return compareByOrder(a.meta?.order, b.meta?.order);
        }
        return a.name.localeCompare(b.name, 'ru');
    });
    const paginated = paginate(filtered, page, limit);
    return { items: paginated, total: filtered.length };
}
exports.default = { listCollectionsWithLegacy };
