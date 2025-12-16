"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Роут скачивания файлов с проверкой прав
// Модули: express, middleware/auth, utils/accessMask, db/model, config/storage, wgLogEngine
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const express_validator_1 = require("express-validator");
const auth_1 = __importDefault(require("../middleware/auth"));
const accessMask_1 = require("../utils/accessMask");
const model_1 = require("../db/model");
const storage_1 = require("../config/storage");
const problem_1 = require("../utils/problem");
const wgLogEngine_1 = require("../services/wgLogEngine");
const dataStorage_1 = require("../services/dataStorage");
const queries_1 = require("../db/queries");
const attachments_1 = require("../utils/attachments");
const validate_1 = __importDefault(require("../utils/validate"));
const di_1 = __importDefault(require("../di"));
const tokens_1 = require("../di/tokens");
const router = (0, express_1.Router)();
const taskSyncController = di_1.default.resolve(tokens_1.TOKENS.TaskSyncController);
router.get('/:id', (0, auth_1.default)(), (0, express_validator_1.param)('id').isMongoId(), async (req, res, next) => {
    var _a, _b, _c, _d, _e, _f;
    try {
        const file = await model_1.File.findById(req.params.id).lean();
        if (!file) {
            (0, problem_1.sendProblem)(req, res, {
                type: 'about:blank',
                title: 'Файл не найден',
                status: 404,
                detail: 'Not Found',
            });
            return;
        }
        const mask = (_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.access) !== null && _b !== void 0 ? _b : 0;
        const uid = Number((_c = req.user) === null || _c === void 0 ? void 0 : _c.id);
        const belongsToTask = Boolean(file.taskId);
        const isOwner = Number.isFinite(uid) && file.userId === uid;
        const isAdmin = (0, accessMask_1.hasAccess)(mask, accessMask_1.ACCESS_ADMIN);
        if (!isOwner && !isAdmin) {
            if (!belongsToTask) {
                (0, problem_1.sendProblem)(req, res, {
                    type: 'about:blank',
                    title: 'Доступ запрещён',
                    status: 403,
                    detail: 'Forbidden',
                });
                return;
            }
            const task = await model_1.Task.findById(file.taskId).lean();
            const allowedIds = [
                task === null || task === void 0 ? void 0 : task.created_by,
                task === null || task === void 0 ? void 0 : task.assigned_user_id,
                task === null || task === void 0 ? void 0 : task.controller_user_id,
                ...((task === null || task === void 0 ? void 0 : task.assignees) || []),
                ...((task === null || task === void 0 ? void 0 : task.controllers) || []),
            ]
                .map((value) => Number(value))
                .filter((value) => Number.isFinite(value));
            if (!Number.isFinite(uid) || !allowedIds.includes(uid)) {
                (0, problem_1.sendProblem)(req, res, {
                    type: 'about:blank',
                    title: 'Доступ запрещён',
                    status: 403,
                    detail: 'Forbidden',
                });
                return;
            }
        }
        const uploadsAbs = path_1.default.resolve(storage_1.uploadsDir);
        const variant = typeof req.query.variant === 'string' ? req.query.variant : undefined;
        const useThumbnail = variant === 'thumbnail';
        if (useThumbnail && !file.thumbnailPath) {
            (0, problem_1.sendProblem)(req, res, {
                type: 'about:blank',
                title: 'Файл не найден',
                status: 404,
                detail: 'Not Found',
            });
            return;
        }
        const relativePath = useThumbnail
            ? ((_d = file.thumbnailPath) !== null && _d !== void 0 ? _d : '')
            : file.path;
        const uploadsTarget = path_1.default.resolve(uploadsAbs, relativePath);
        const relative = path_1.default.relative(uploadsAbs, uploadsTarget);
        if (relative.startsWith('..') ||
            path_1.default.isAbsolute(relative) ||
            relative.length === 0) {
            (0, problem_1.sendProblem)(req, res, {
                type: 'about:blank',
                title: 'Недопустимое имя файла',
                status: 400,
                detail: 'Bad Request',
            });
            return;
        }
        const safeName = path_1.default.basename((_f = (_e = file.name) !== null && _e !== void 0 ? _e : file.path) !== null && _f !== void 0 ? _f : 'file');
        const inlineMode = req.query.mode === 'inline';
        const logMessage = inlineMode ? 'Просмотрен файл' : 'Скачан файл';
        void (0, wgLogEngine_1.writeLog)(logMessage, 'info', { userId: uid, name: file.name });
        if (inlineMode) {
            const mime = useThumbnail
                ? 'image/jpeg'
                : file.type || 'application/octet-stream';
            res.type(mime);
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Content-Disposition', 'inline');
            res.sendFile(uploadsTarget, (error) => {
                if (error)
                    next(error);
            });
            return;
        }
        res.download(uploadsTarget, safeName, (error) => {
            if (error)
                next(error);
        });
    }
    catch (err) {
        next(err);
    }
});
router.delete('/:id', (0, auth_1.default)(), (0, express_validator_1.param)('id').isMongoId(), async (req, res, next) => {
    var _a, _b, _c;
    try {
        const file = await model_1.File.findById(req.params.id).lean();
        if (!file) {
            (0, problem_1.sendProblem)(req, res, {
                type: 'about:blank',
                title: 'Файл не найден',
                status: 404,
                detail: 'Not Found',
            });
            return;
        }
        const mask = (_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.access) !== null && _b !== void 0 ? _b : 0;
        const uid = Number((_c = req.user) === null || _c === void 0 ? void 0 : _c.id);
        const belongsToTask = Boolean(file.taskId);
        const isOwner = Number.isFinite(uid) && file.userId === uid;
        const isAdmin = (0, accessMask_1.hasAccess)(mask, accessMask_1.ACCESS_ADMIN);
        if (!isOwner && !isAdmin) {
            if (!belongsToTask) {
                (0, problem_1.sendProblem)(req, res, {
                    type: 'about:blank',
                    title: 'Доступ запрещён',
                    status: 403,
                    detail: 'Forbidden',
                });
                return;
            }
            const task = await model_1.Task.findById(file.taskId).lean();
            const allowedIds = [
                task === null || task === void 0 ? void 0 : task.created_by,
                task === null || task === void 0 ? void 0 : task.assigned_user_id,
                task === null || task === void 0 ? void 0 : task.controller_user_id,
                ...((task === null || task === void 0 ? void 0 : task.assignees) || []),
                ...((task === null || task === void 0 ? void 0 : task.controllers) || []),
            ]
                .map((value) => Number(value))
                .filter((value) => Number.isFinite(value));
            if (!Number.isFinite(uid) || !allowedIds.includes(uid)) {
                (0, problem_1.sendProblem)(req, res, {
                    type: 'about:blank',
                    title: 'Доступ запрещён',
                    status: 403,
                    detail: 'Forbidden',
                });
                return;
            }
        }
        const deletionResult = await (0, dataStorage_1.deleteFile)(req.params.id);
        void (0, wgLogEngine_1.writeLog)('Удалён файл', 'info', { userId: uid, name: file.name });
        if (deletionResult === null || deletionResult === void 0 ? void 0 : deletionResult.taskId) {
            const normalizedUserId = Number.isFinite(uid) ? Number(uid) : undefined;
            const attachmentsForSync = deletionResult.attachments !== undefined
                ? deletionResult.attachments
                : [];
            try {
                await (0, queries_1.syncTaskAttachments)(deletionResult.taskId, attachmentsForSync, normalizedUserId);
            }
            catch (syncError) {
                console.error('Не удалось обновить список вложений после удаления файла', syncError);
            }
            try {
                await taskSyncController.syncAfterChange(deletionResult.taskId);
            }
            catch (telegramError) {
                console.error('Не удалось синхронизировать задачу в Telegram после удаления файла', telegramError);
            }
        }
        res.status(204).send();
    }
    catch (error) {
        const err = error;
        if (err.code === 'ENOENT') {
            (0, problem_1.sendProblem)(req, res, {
                type: 'about:blank',
                title: 'Файл не найден',
                status: 404,
                detail: 'Not Found',
            });
            return;
        }
        next(error);
    }
});
router.post('/:id/attach', (0, auth_1.default)(), ...(0, validate_1.default)([
    (0, express_validator_1.param)('id').isMongoId().withMessage('Некорректный идентификатор файла'),
    (0, express_validator_1.body)('taskId')
        .isString()
        .withMessage('Некорректный идентификатор задачи')
        .bail()
        .trim()
        .notEmpty()
        .withMessage('ID задачи обязателен')
        .bail()
        .isMongoId()
        .withMessage('ID задачи должен быть ObjectId'),
]), async (req, res, next) => {
    var _a, _b, _c, _d, _e;
    try {
        const file = await model_1.File.findById(req.params.id).lean();
        if (!file) {
            (0, problem_1.sendProblem)(req, res, {
                type: 'about:blank',
                title: 'Файл не найден',
                status: 404,
                detail: 'Not Found',
            });
            return;
        }
        const mask = (_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.access) !== null && _b !== void 0 ? _b : 0;
        const uid = Number((_c = req.user) === null || _c === void 0 ? void 0 : _c.id);
        const isOwner = Number.isFinite(uid) && file.userId === uid;
        const isAdmin = (0, accessMask_1.hasAccess)(mask, accessMask_1.ACCESS_ADMIN);
        if (!isOwner && !isAdmin) {
            (0, problem_1.sendProblem)(req, res, {
                type: 'about:blank',
                title: 'Доступ запрещён',
                status: 403,
                detail: 'Forbidden',
            });
            return;
        }
        const body = ((_d = req.body) !== null && _d !== void 0 ? _d : {});
        const taskIdRaw = typeof body.taskId === 'string' ? body.taskId : '';
        const taskId = taskIdRaw.trim();
        const task = await model_1.Task.findById(taskId).lean();
        if (!task) {
            (0, problem_1.sendProblem)(req, res, {
                type: 'about:blank',
                title: 'Задача не найдена',
                status: 404,
                detail: 'Not Found',
            });
            return;
        }
        const allowedTaskIds = [
            task === null || task === void 0 ? void 0 : task.created_by,
            task === null || task === void 0 ? void 0 : task.assigned_user_id,
            task === null || task === void 0 ? void 0 : task.controller_user_id,
            ...(Array.isArray(task === null || task === void 0 ? void 0 : task.assignees) ? task.assignees : []),
            ...(Array.isArray(task === null || task === void 0 ? void 0 : task.controllers) ? task.controllers : []),
        ]
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value));
        const isTaskMember = Number.isFinite(uid) && allowedTaskIds.includes(uid);
        if (!isAdmin && !isTaskMember) {
            (0, problem_1.sendProblem)(req, res, {
                type: 'about:blank',
                title: 'Доступ запрещён',
                status: 403,
                detail: 'Forbidden',
            });
            return;
        }
        const fileId = String((_e = file._id) !== null && _e !== void 0 ? _e : req.params.id);
        const baseUrl = `/api/v1/files/${fileId}`;
        const cleanupRegexSource = `/${fileId}(?:$|[/?#])`;
        const cleanupPattern = new RegExp(cleanupRegexSource, 'i');
        await model_1.Task.updateMany({
            _id: { $ne: task._id },
            attachments: { $elemMatch: { url: cleanupPattern } },
        }, {
            $pull: {
                attachments: { url: cleanupPattern },
            },
        }).exec();
        const existingAttachments = Array.isArray(task.attachments)
            ? [...task.attachments]
            : [];
        const now = new Date();
        const uploadedAtSource = file.uploadedAt instanceof Date
            ? file.uploadedAt
            : typeof file.uploadedAt === 'string'
                ? new Date(file.uploadedAt)
                : now;
        const uploadedAt = uploadedAtSource instanceof Date &&
            !Number.isNaN(uploadedAtSource.getTime())
            ? uploadedAtSource
            : now;
        const uploadedByRaw = typeof file.userId === 'number' && Number.isFinite(file.userId)
            ? file.userId
            : Number.isFinite(uid)
                ? uid
                : undefined;
        const uploadedBy = typeof uploadedByRaw === 'number' && Number.isFinite(uploadedByRaw)
            ? uploadedByRaw
            : 0;
        const thumbnailUrl = typeof file.thumbnailPath === 'string' &&
            file.thumbnailPath.trim().length > 0
            ? `/uploads/${file.thumbnailPath.trim()}`
            : undefined;
        const payload = {
            name: typeof file.name === 'string' ? file.name : 'Файл',
            url: baseUrl,
            uploadedBy,
            uploadedAt,
            type: typeof file.type === 'string' && file.type.trim().length > 0
                ? file.type
                : 'application/octet-stream',
            size: typeof file.size === 'number' &&
                Number.isFinite(file.size) &&
                file.size >= 0
                ? file.size
                : 0,
        };
        if (thumbnailUrl) {
            payload.thumbnailUrl = thumbnailUrl;
        }
        const nextAttachments = existingAttachments.filter((attachment) => (0, attachments_1.extractFileIdFromUrl)(attachment === null || attachment === void 0 ? void 0 : attachment.url) !== fileId);
        nextAttachments.push(payload);
        await model_1.Task.updateOne({ _id: task._id }, { $set: { attachments: nextAttachments } });
        const userIdForSync = Number.isFinite(uid) ? uid : undefined;
        await (0, queries_1.syncTaskAttachments)(taskId, nextAttachments, userIdForSync);
        res.json({ ok: true, taskId });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
