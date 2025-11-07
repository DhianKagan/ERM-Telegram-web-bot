"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Роуты коллекций: CRUD операции
// Модули: express, middleware/auth, middleware/requireRole, middleware/sendProblem, repos/collectionRepo, express-validator
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const mongoose_1 = require("mongoose");
const rateLimiter_1 = __importDefault(require("../utils/rateLimiter"));
const auth_1 = __importDefault(require("../middleware/auth"));
const requireRole_1 = __importDefault(require("../middleware/requireRole"));
const repo = __importStar(require("../db/repos/collectionRepo"));
const CollectionItem_1 = require("../db/models/CollectionItem");
const employee_1 = require("../db/models/employee");
const model_1 = require("../db/model");
const collectionsAggregator_1 = require("../services/collectionsAggregator");
const problem_1 = require("../utils/problem");
const validate_1 = __importDefault(require("../utils/validate"));
const telegramTopics_1 = require("../utils/telegramTopics");
const taskTypeSettings_1 = require("../services/taskTypeSettings");
const router = (0, express_1.Router)();
const limiter = (0, rateLimiter_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    name: 'collections',
});
const base = [(0, auth_1.default)(), limiter];
router.get('/', ...base, async (req, res) => {
    const { page = '1', limit = '20', type, name, value, search, } = req.query;
    const { items, total } = await (0, collectionsAggregator_1.listCollectionsWithLegacy)({ type, name, value, search }, Number(page), Number(limit));
    res.json({ items, total });
});
router.get('/:type', ...base, async (req, res) => {
    const { type } = req.params;
    const { items } = await (0, collectionsAggregator_1.listCollectionsWithLegacy)({ type }, 1, 1000);
    res.json(items);
});
const normalizeDepartmentValue = (raw) => raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .join(',');
const normalizeValueByType = (type, raw) => {
    const safeType = type.trim();
    if (safeType === 'departments') {
        return normalizeDepartmentValue(raw);
    }
    return raw.trim();
};
const TELEGRAM_TOPIC_HINT = 'Ссылка на тему Telegram должна иметь формат https://t.me/c/<id>/<topic>';
const prepareMetaByType = (type, metaRaw) => {
    if (type === 'task_types') {
        if (!metaRaw || typeof metaRaw !== 'object') {
            return { meta: undefined };
        }
        const rawUrl = metaRaw.tg_theme_url;
        const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
        const rawPhotosUrl = metaRaw.tg_photos_url;
        const photosUrl = typeof rawPhotosUrl === 'string' ? rawPhotosUrl.trim() : '';
        const meta = {};
        if (url) {
            const parsed = (0, telegramTopics_1.parseTelegramTopicUrl)(url);
            if (!parsed) {
                return { error: TELEGRAM_TOPIC_HINT };
            }
            meta.tg_theme_url = url;
            meta.tg_chat_id = parsed.chatId;
            meta.tg_topic_id = parsed.topicId;
        }
        if (photosUrl) {
            const parsed = (0, telegramTopics_1.parseTelegramTopicUrl)(photosUrl);
            if (!parsed) {
                return { error: TELEGRAM_TOPIC_HINT };
            }
            meta.tg_photos_url = photosUrl;
            meta.tg_photos_chat_id = parsed.chatId;
            meta.tg_photos_topic_id = parsed.topicId;
        }
        if (!Object.keys(meta).length) {
            return { meta: undefined };
        }
        return { meta };
    }
    if (!metaRaw || typeof metaRaw !== 'object') {
        return { meta: undefined };
    }
    return { meta: { ...metaRaw } };
};
router.post('/', ...base, (0, requireRole_1.default)('admin'), ...(0, validate_1.default)([
    (0, express_validator_1.body)('type')
        .isString()
        .withMessage('Некорректный тип коллекции')
        .bail()
        .trim()
        .notEmpty()
        .withMessage('Тип коллекции обязателен'),
    (0, express_validator_1.body)('name')
        .isString()
        .withMessage('Некорректное название элемента')
        .bail()
        .trim()
        .notEmpty()
        .withMessage('Название элемента обязательно'),
    (0, express_validator_1.body)('value')
        .isString()
        .withMessage('Некорректное значение элемента')
        .bail()
        .custom((raw, { req }) => {
        if (typeof raw !== 'string')
            return false;
        const type = typeof req.body?.type === 'string' ? req.body.type.trim() : '';
        const normalized = normalizeValueByType(type, raw);
        if (type === 'departments') {
            return true;
        }
        return normalized.length > 0;
    })
        .withMessage('Значение элемента обязательно'),
]), async (req, res, next) => {
    try {
        const body = req.body;
        const type = body.type.trim();
        const name = body.name.trim();
        const rawValue = typeof body.value === 'string' ? body.value : '';
        const value = normalizeValueByType(type, rawValue);
        if (type !== 'departments' && !value) {
            (0, problem_1.sendProblem)(req, res, {
                type: 'about:blank',
                title: 'Ошибка валидации',
                status: 400,
                detail: 'Поля: value — Значение элемента обязательно',
            });
            return;
        }
        const { meta, error: metaError } = prepareMetaByType(type, body.meta);
        if (metaError) {
            (0, problem_1.sendProblem)(req, res, {
                type: 'about:blank',
                title: 'Ошибка валидации',
                status: 400,
                detail: metaError,
            });
            return;
        }
        const item = await repo.create({
            type,
            name,
            value,
            ...(meta ? { meta } : {}),
        });
        if (type === 'task_types') {
            (0, taskTypeSettings_1.invalidateTaskTypeSettingsCache)();
        }
        res.status(201).json(item);
    }
    catch (error) {
        if (error instanceof mongoose_1.Error.ValidationError) {
            (0, problem_1.sendProblem)(req, res, {
                type: 'about:blank',
                title: 'Ошибка валидации',
                status: 400,
                detail: error.message,
            });
            return;
        }
        next(error);
    }
});
router.put('/:id', ...base, (0, requireRole_1.default)('admin'), (0, express_validator_1.param)('id').isMongoId(), ...(0, validate_1.default)([
    (0, express_validator_1.body)('name')
        .optional()
        .isString()
        .withMessage('Некорректное название элемента')
        .bail()
        .custom((raw) => {
        if (typeof raw !== 'string')
            return false;
        return raw.trim().length > 0;
    })
        .withMessage('Название элемента не может быть пустым'),
    (0, express_validator_1.body)('value')
        .optional()
        .isString()
        .withMessage('Некорректное значение элемента'),
]), async (req, res, next) => {
    try {
        const existing = await CollectionItem_1.CollectionItem.findById(req.params.id).select('type');
        if (!existing) {
            res.sendStatus(404);
            return;
        }
        const body = req.body;
        const payload = {};
        if (typeof body.name === 'string') {
            payload.name = body.name.trim();
            if (!payload.name) {
                (0, problem_1.sendProblem)(req, res, {
                    type: 'about:blank',
                    title: 'Ошибка валидации',
                    status: 400,
                    detail: 'Название элемента не может быть пустым',
                });
                return;
            }
        }
        if (typeof body.value === 'string') {
            const normalizedValue = normalizeValueByType(existing.type, body.value);
            if (existing.type !== 'departments' && !normalizedValue) {
                (0, problem_1.sendProblem)(req, res, {
                    type: 'about:blank',
                    title: 'Ошибка валидации',
                    status: 400,
                    detail: 'Поля: value — Значение элемента не может быть пустым',
                });
                return;
            }
            payload.value = normalizedValue;
        }
        if (Object.prototype.hasOwnProperty.call(body, 'meta')) {
            const { meta, error: metaError } = prepareMetaByType(existing.type, body.meta);
            if (metaError) {
                (0, problem_1.sendProblem)(req, res, {
                    type: 'about:blank',
                    title: 'Ошибка валидации',
                    status: 400,
                    detail: metaError,
                });
                return;
            }
            payload.meta = meta;
        }
        const item = await repo.update(existing.id, payload);
        if (!item) {
            res.sendStatus(404);
            return;
        }
        if (existing.type === 'task_types') {
            (0, taskTypeSettings_1.invalidateTaskTypeSettingsCache)();
        }
        res.json(item);
    }
    catch (error) {
        if (error instanceof mongoose_1.Error.ValidationError) {
            (0, problem_1.sendProblem)(req, res, {
                type: 'about:blank',
                title: 'Ошибка валидации',
                status: 400,
                detail: error.message,
            });
            return;
        }
        next(error);
    }
});
router.delete('/:id', ...base, (0, requireRole_1.default)('admin'), (0, express_validator_1.param)('id').isMongoId(), async (req, res) => {
    const item = await CollectionItem_1.CollectionItem.findById(req.params.id);
    if (!item) {
        res.sendStatus(404);
        return;
    }
    if (item.type === 'departments') {
        const hasTasks = await model_1.Task.exists({
            department: item._id,
        });
        const hasEmployees = await employee_1.Employee.exists({ departmentId: item._id });
        if (hasTasks || hasEmployees) {
            res.status(409).json({
                error: 'Нельзя удалить департамент: есть связанные задачи или сотрудники',
            });
            return;
        }
    }
    const type = item.type;
    await item.deleteOne();
    if (type === 'task_types') {
        (0, taskTypeSettings_1.invalidateTaskTypeSettingsCache)();
    }
    res.json({ status: 'ok' });
});
exports.default = router;
