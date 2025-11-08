"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeArrays = exports.handleChunks = exports.processUploads = void 0;
// Роуты задач: CRUD, время, массовые действия, миниатюры вложений, chunk-upload
// Модули: express, express-validator, controllers/tasks, middleware/auth, multer, sharp, fluent-ffmpeg, clamdjs, wgLogEngine
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const multer_1 = __importDefault(require("multer"));
const sharp_1 = __importDefault(require("sharp"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const express_1 = require("express");
const rateLimiter_1 = __importDefault(require("../utils/rateLimiter"));
const express_validator_1 = require("express-validator");
const di_1 = __importDefault(require("../di"));
const tasks_controller_1 = __importDefault(require("../tasks/tasks.controller"));
const auth_1 = __importDefault(require("../middleware/auth"));
const validateDto_1 = __importDefault(require("../middleware/validateDto"));
const tasks_dto_1 = require("../dto/tasks.dto");
const taskAccess_1 = __importDefault(require("../middleware/taskAccess"));
const form_1 = require("../form");
const storage_1 = require("../config/storage");
const model_1 = require("../db/model");
const queries_1 = require("../db/queries");
const antivirus_1 = require("../services/antivirus");
const wgLogEngine_1 = require("../services/wgLogEngine");
const limits_1 = require("../config/limits");
const fileCheck_1 = require("../utils/fileCheck");
const attachments_1 = require("../utils/attachments");
const requestUploads_1 = require("../utils/requestUploads");
const uploadContext_1 = require("../tasks/uploadContext");
const uploadFinalizer_1 = require("../tasks/uploadFinalizer");
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = __importDefault(require("../auth/roles.guard"));
const accessMask_1 = require("../utils/accessMask");
const fileUrls_1 = require("../utils/fileUrls");
const validate_1 = require("../utils/validate");
const safeMoveFile_1 = require("../lib/fs/safeMoveFile");
if (!fs_1.default.existsSync(storage_1.uploadsDir))
    fs_1.default.mkdirSync(storage_1.uploadsDir, { recursive: true });
if (ffmpeg_static_1.default)
    fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_static_1.default);
const mergeAttachments = (current, incoming) => {
    const map = new Map();
    for (const attachment of current) {
        map.set(attachment.url, attachment);
    }
    for (const attachment of incoming) {
        map.set(attachment.url, attachment);
    }
    return Array.from(map.values());
};
function readAttachmentsField(value) {
    const parsed = (0, attachments_1.coerceAttachments)(value);
    return Array.isArray(parsed) ? parsed : [];
}
const uploadsDirAbs = path_1.default.resolve(storage_1.uploadsDir);
function relativeToUploads(target) {
    const absolute = path_1.default.resolve(target);
    const relative = path_1.default.relative(uploadsDirAbs, absolute);
    if (relative.startsWith('..') ||
        path_1.default.isAbsolute(relative) ||
        relative.length === 0) {
        return undefined;
    }
    return relative.split(path_1.default.sep).join('/');
}
async function createThumbnail(file) {
    const filePath = path_1.default.join(file.destination, file.filename);
    const thumbName = `thumb_${path_1.default.parse(file.filename).name}.jpg`;
    const thumbPath = path_1.default.join(file.destination, thumbName);
    try {
        if (file.mimetype.startsWith('image/')) {
            await (0, sharp_1.default)(filePath).resize(320, 240, { fit: 'inside' }).toFile(thumbPath);
            return thumbPath;
        }
        if (file.mimetype.startsWith('video/')) {
            await new Promise((resolve, reject) => {
                (0, fluent_ffmpeg_1.default)(filePath)
                    .on('end', () => resolve())
                    .on('error', reject)
                    .screenshots({
                    count: 1,
                    filename: thumbName,
                    folder: file.destination,
                    size: '320x?',
                });
            });
            return thumbPath;
        }
    }
    catch (error) {
        await fs_1.default.promises.unlink(thumbPath).catch(() => undefined);
        await (0, wgLogEngine_1.writeLog)('Не удалось создать миниатюру', 'warn', {
            path: filePath,
            error: error.message,
        });
    }
    return undefined;
}
function resolveNumericUserId(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value.trim());
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return undefined;
}
const selectTaskIdCandidate = (value) => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
    if (Array.isArray(value)) {
        for (const entry of value) {
            if (typeof entry === 'string') {
                const trimmed = entry.trim();
                if (trimmed.length > 0) {
                    return trimmed;
                }
            }
        }
    }
    return undefined;
};
const readTaskIdFromRequest = (req) => {
    const body = req.body;
    const bodyTaskId = selectTaskIdCandidate(body?.taskId);
    if (bodyTaskId)
        return bodyTaskId;
    const bodySnakeTaskId = selectTaskIdCandidate(body?.task_id);
    if (bodySnakeTaskId)
        return bodySnakeTaskId;
    const queryTaskId = selectTaskIdCandidate(req.query?.taskId);
    if (queryTaskId)
        return queryTaskId;
    const querySnakeTaskId = selectTaskIdCandidate(req.query?.task_id);
    if (querySnakeTaskId)
        return querySnakeTaskId;
    return undefined;
};
const syncAttachmentsForRequest = async (req, attachments) => {
    if (!Array.isArray(attachments) || attachments.length === 0) {
        return;
    }
    const taskId = readTaskIdFromRequest(req);
    if (!taskId) {
        return;
    }
    const userId = resolveNumericUserId(req.user?.id);
    const normalizedAttachments = attachments;
    try {
        await (0, queries_1.syncTaskAttachments)(taskId, normalizedAttachments, userId);
        return;
    }
    catch (error) {
        const trimmedId = typeof taskId === 'string' ? taskId.trim() : undefined;
        if (trimmedId) {
            try {
                const resolvedId = await (0, queries_1.findTaskIdByPublicIdentifier)(trimmedId, userId);
                if (resolvedId) {
                    await (0, queries_1.syncTaskAttachments)(resolvedId, normalizedAttachments, userId);
                    return;
                }
            }
            catch (fallbackError) {
                await Promise.resolve((0, wgLogEngine_1.writeLog)('Не удалось привязать вложения после поиска задачи по номеру', 'warn', {
                    taskNumber: trimmedId,
                    userId,
                    error: fallbackError.message,
                })).catch(() => undefined);
            }
        }
        await Promise.resolve((0, wgLogEngine_1.writeLog)('Не удалось привязать вложения к задаче при загрузке', 'error', {
            taskId,
            userId,
            error: error.message,
        })).catch(() => undefined);
    }
};
const processUploads = async (req, res, next) => {
    try {
        const filesRaw = req.files;
        const files = Array.isArray(filesRaw)
            ? filesRaw
            : [];
        const existingAttachments = readAttachmentsField(req.body.attachments);
        // Проверяем тип полученных файлов
        if (!Array.isArray(filesRaw) &&
            filesRaw !== undefined &&
            filesRaw !== null) {
            res.status(400).json({ error: 'Некорректный формат загрузки файлов' });
            return;
        }
        let createdAttachments = [];
        if (files.length > 0) {
            const userId = resolveNumericUserId(req.user?.id);
            if (userId === undefined) {
                res.status(403).json({ error: 'Не удалось определить пользователя' });
                return;
            }
            const graceMinutes = limits_1.staleUserFilesGraceMinutes;
            const shouldApplyGrace = Number.isFinite(graceMinutes) && graceMinutes > 0;
            const cutoff = shouldApplyGrace
                ? new Date(Date.now() - graceMinutes * 60 * 1000)
                : null;
            if (shouldApplyGrace && cutoff) {
                try {
                    const staleQuery = model_1.File.find({
                        userId,
                        taskId: null,
                        draftId: null,
                        uploadedAt: { $lte: cutoff },
                    }, { path: 1, thumbnailPath: 1 }).lean();
                    const staleEntries = await (typeof staleQuery.exec === 'function'
                        ? staleQuery.exec()
                        : Promise.resolve(staleQuery));
                    if (staleEntries.length > 0) {
                        const staleIds = staleEntries.map((entry) => entry._id);
                        await model_1.File.deleteMany({ _id: { $in: staleIds } });
                        for (const entry of staleEntries) {
                            const targets = [entry.path, entry.thumbnailPath].filter((v) => Boolean(v && v.length > 0));
                            for (const relative of targets) {
                                const fullPath = path_1.default.join(storage_1.uploadsDir, relative);
                                await fs_1.default.promises.unlink(fullPath).catch(async (err) => {
                                    await (0, wgLogEngine_1.writeLog)('Не удалось удалить файл', 'error', {
                                        path: fullPath,
                                        error: err.message,
                                    });
                                });
                            }
                        }
                        await (0, wgLogEngine_1.writeLog)('Удалены устаревшие вложения', 'info', {
                            userId,
                            count: staleEntries.length,
                        });
                    }
                }
                catch (cleanupError) {
                    await (0, wgLogEngine_1.writeLog)('Не удалось очистить устаревшие вложения', 'error', {
                        userId,
                        error: cleanupError.message,
                    });
                }
            }
            const aggregation = await model_1.File.aggregate([
                { $match: { userId } },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 },
                        size: { $sum: '$size' },
                    },
                },
            ]);
            const rawStats = aggregation[0] || {};
            const stats = {
                count: rawStats.count ?? 0,
                size: rawStats.size ?? 0,
            };
            const incoming = files.reduce((s, f) => s + f.size, 0);
            if (stats.count + files.length > limits_1.maxUserFiles ||
                stats.size + incoming > limits_1.maxUserStorage) {
                for (const f of files) {
                    const p = path_1.default.join(f.destination, f.filename);
                    try {
                        await fs_1.default.promises.unlink(p);
                    }
                    catch (e) {
                        await (0, wgLogEngine_1.writeLog)('Не удалось удалить файл', 'error', {
                            path: p,
                            error: e.message,
                        });
                        res.sendStatus(500);
                        return;
                    }
                }
                res.status(400).json({ error: 'Превышены лимиты вложений' });
                return;
            }
            for (const f of files) {
                const full = path_1.default.join(f.destination, f.filename);
                if (!(await (0, antivirus_1.scanFile)(full))) {
                    try {
                        await fs_1.default.promises.unlink(full);
                    }
                    catch (e) {
                        await (0, wgLogEngine_1.writeLog)('Не удалось удалить файл', 'error', {
                            path: full,
                            error: e.message,
                        });
                        res.sendStatus(500);
                        return;
                    }
                    res.status(400).json({ error: 'Файл содержит вирус' });
                    return;
                }
            }
            const context = (0, uploadContext_1.ensureUploadContext)(req, userId);
            const attachments = [];
            const isInsideDir = (baseDir, targetPath) => {
                const base = path_1.default.resolve(baseDir);
                const target = path_1.default.resolve(targetPath);
                if (base === target) {
                    return false;
                }
                const relative = path_1.default.relative(base, target);
                return (relative.length > 0 &&
                    !relative.startsWith('..') &&
                    !path_1.default.isAbsolute(relative));
            };
            for (const f of files) {
                const original = path_1.default.basename(f.originalname);
                const storedPath = path_1.default.resolve(f.destination, f.filename);
                const withinContext = isInsideDir(context.dir, storedPath);
                const withinUploads = isInsideDir(uploadsDirAbs, storedPath);
                if (!withinContext && !withinUploads) {
                    await fs_1.default.promises.unlink(storedPath).catch(() => undefined);
                    const err = new Error('INVALID_PATH');
                    throw err;
                }
                const thumbAbs = await createThumbnail(f);
                const placeholder = `temp://${(0, crypto_1.randomBytes)(12).toString('hex')}`;
                (0, requestUploads_1.appendPendingUpload)(req, {
                    placeholder,
                    tempPath: storedPath,
                    tempThumbnailPath: thumbAbs,
                    tempDir: context.dir,
                    originalName: original,
                    mimeType: f.mimetype,
                    size: f.size,
                    userId,
                });
                attachments.push({
                    name: original,
                    url: placeholder,
                    thumbnailUrl: undefined,
                    uploadedBy: userId,
                    uploadedAt: new Date(),
                    type: f.mimetype,
                    size: f.size,
                });
            }
            createdAttachments = attachments;
        }
        req.body.attachments = mergeAttachments(existingAttachments, createdAttachments);
        next();
    }
    catch (error) {
        await (0, uploadFinalizer_1.purgeTemporaryUploads)(req).catch(() => undefined);
        if (res.headersSent)
            return;
        if (error.message === 'INVALID_PATH') {
            res.status(400).json({ error: 'Недопустимый путь файла' });
            return;
        }
        res.sendStatus(500);
    }
};
exports.processUploads = processUploads;
const router = (0, express_1.Router)();
const ctrl = di_1.default.resolve(tasks_controller_1.default);
const ensureRequestHandler = (value, methodName) => {
    if (typeof value === 'function') {
        return value;
    }
    console.error(`Контроллер задач не реализует метод ${methodName}, используется заглушка`);
    return ((_, res) => {
        res.status(501).json({
            error: `Метод ${methodName} временно недоступен`,
        });
    });
};
const downloadPdfHandler = ensureRequestHandler(ctrl.downloadPdf, 'downloadPdf');
const downloadExcelHandler = ensureRequestHandler(ctrl.downloadExcel, 'downloadExcel');
const chunkUploadDirs = new Map();
const makeChunkKey = (userId, fileId) => `${userId}:${fileId}`;
const resolveChunkUploadDir = (req, userId, fileId) => {
    const context = (0, uploadContext_1.ensureUploadContext)(req, userId);
    const key = makeChunkKey(userId, fileId);
    const existing = chunkUploadDirs.get(key);
    if (existing) {
        context.dir = existing;
        return existing;
    }
    chunkUploadDirs.set(key, context.dir);
    return context.dir;
};
const releaseChunkUploadDir = (userId, fileId) => {
    chunkUploadDirs.delete(makeChunkKey(userId, fileId));
};
const storage = multer_1.default.diskStorage({
    destination: (req, _file, cb) => {
        const userId = resolveNumericUserId(req.user?.id);
        if (userId === undefined) {
            cb(new Error('UPLOAD_USER_RESOLVE_FAILED'), '');
            return;
        }
        let contextDir = '';
        try {
            const context = (0, uploadContext_1.ensureUploadContext)(req, userId);
            contextDir = context.dir;
            fs_1.default.mkdirSync(contextDir, { recursive: true });
            cb(null, contextDir);
        }
        catch (error) {
            cb(error, contextDir);
        }
    },
    filename: (_req, file, cb) => {
        const original = path_1.default.basename(file.originalname);
        cb(null, `${Date.now()}_${original}`);
    },
});
const maxUploadSize = 10 * 1024 * 1024;
const sharedFileFilter = (_req, file, cb) => {
    if ((0, fileCheck_1.checkFile)(file)) {
        cb(null, true);
        return;
    }
    cb(new Error('Недопустимый тип файла'));
};
const sharedLimits = {
    fileSize: maxUploadSize,
};
const upload = (0, multer_1.default)({
    storage,
    fileFilter: sharedFileFilter,
    limits: sharedLimits,
});
const inlineUpload = upload.single('upload');
const chunkUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    fileFilter: sharedFileFilter,
    limits: sharedLimits,
});
const chunkUploadMiddleware = (req, res, next) => {
    chunkUpload.single('file')(req, res, (err) => {
        if (err) {
            const message = err instanceof multer_1.default.MulterError && err.code === 'LIMIT_FILE_SIZE'
                ? 'Файл превышает допустимый размер'
                : err.message;
            res.status(400).json({ error: message });
            return;
        }
        next();
    });
};
const detailLimiter = (0, rateLimiter_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    name: 'task-detail',
});
const tasksLimiter = (0, rateLimiter_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    name: 'tasks',
});
router.use((0, auth_1.default)());
router.use(tasksLimiter);
const requireTaskCreationRights = [
    (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_MANAGER),
    roles_guard_1.default,
];
const handleInlineUpload = async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            res.status(400).json({ error: 'Файл не получен' });
            return;
        }
        if (!file.mimetype.startsWith('image/')) {
            res.status(400).json({ error: 'Допустимы только изображения' });
            return;
        }
        req.files = [file];
        req.body.attachments = [];
        await new Promise((resolve, reject) => {
            (0, exports.processUploads)(req, res, (error) => {
                if (error)
                    reject(error);
                else
                    resolve();
            });
        });
        if (res.headersSent) {
            await (0, uploadFinalizer_1.purgeTemporaryUploads)(req).catch(() => undefined);
            return;
        }
        const bodyWithAttachments = req.body;
        const finalizeResult = await (0, uploadFinalizer_1.finalizePendingUploads)({
            req: req,
            attachments: bodyWithAttachments.attachments ?? [],
        });
        bodyWithAttachments.attachments =
            finalizeResult.attachments;
        if (res.headersSent)
            return;
        const attachment = bodyWithAttachments.attachments?.[0];
        if (!attachment?.url) {
            res.status(500).json({ error: 'Не удалось сохранить файл' });
            return;
        }
        await syncAttachmentsForRequest(req, [attachment]);
        const inlineUrl = (() => {
            const base = attachment.url;
            if (typeof base !== 'string') {
                return base;
            }
            const [pathPart] = base.split('?');
            const segments = pathPart.split('/').filter(Boolean);
            const identifier = segments[segments.length - 1];
            return identifier ? (0, fileUrls_1.buildInlineFileUrl)(identifier) : base;
        })();
        res.json({
            url: inlineUrl,
            thumbnailUrl: attachment.thumbnailUrl,
            originalUrl: attachment.url,
        });
    }
    catch (error) {
        if (res.headersSent)
            return;
        const message = error instanceof Error && error.message
            ? error.message
            : 'Не удалось загрузить файл';
        res.status(500).json({ error: message });
    }
};
const handleChunks = async (req, res) => {
    let cleanupUserId;
    let cleanupFileId;
    try {
        const { fileId, chunkIndex, totalChunks } = req.body;
        if (typeof fileId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(fileId)) {
            res.status(400).json({ error: 'Недопустимый идентификатор файла' });
            return;
        }
        const file = req.file;
        if (!file) {
            res.status(400).json({ error: 'Файл не получен' });
            return;
        }
        const idx = Number(chunkIndex);
        const total = Number(totalChunks);
        if (!Number.isInteger(idx) ||
            !Number.isInteger(total) ||
            idx < 0 ||
            total <= 0 ||
            idx >= total) {
            res.status(400).json({ error: 'Недопустимый индекс' });
            return;
        }
        const userId = resolveNumericUserId(req.user?.id);
        if (userId === undefined) {
            res.status(403).json({ error: 'Не удалось определить пользователя' });
            return;
        }
        cleanupUserId = userId;
        cleanupFileId = fileId;
        const baseDir = resolveChunkUploadDir(req, userId, fileId);
        const dir = path_1.default.resolve(baseDir, fileId);
        if (!dir.startsWith(baseDir + path_1.default.sep)) {
            releaseChunkUploadDir(userId, fileId);
            res.status(400).json({ error: 'Недопустимый путь' });
            return;
        }
        fs_1.default.mkdirSync(dir, { recursive: true });
        const chunkPath = path_1.default.resolve(dir, String(idx));
        if (!chunkPath.startsWith(dir + path_1.default.sep)) {
            releaseChunkUploadDir(userId, fileId);
            res.status(400).json({ error: 'Недопустимый путь части' });
            return;
        }
        fs_1.default.writeFileSync(chunkPath, file.buffer);
        if (idx + 1 === total) {
            const originalName = path_1.default.basename(file.originalname);
            const storedName = `${Date.now()}_${originalName}`;
            const final = path_1.default.resolve(dir, storedName);
            let cleanedTemp = false;
            const cleanupTemp = () => {
                if (!cleanedTemp) {
                    fs_1.default.rmSync(dir, { recursive: true, force: true });
                    cleanedTemp = true;
                }
            };
            const cleanupAll = () => {
                releaseChunkUploadDir(userId, fileId);
                cleanupTemp();
            };
            if (!final.startsWith(dir + path_1.default.sep)) {
                cleanupAll();
                res.status(400).json({ error: 'Недопустимое имя файла' });
                return;
            }
            let assembledSize = 0;
            for (let i = 0; i < total; i++) {
                const partPath = path_1.default.resolve(dir, String(i));
                if (!partPath.startsWith(dir + path_1.default.sep)) {
                    fs_1.default.rmSync(final, { force: true });
                    cleanupAll();
                    res.status(400).json({ error: 'Недопустимый путь части' });
                    return;
                }
                const part = fs_1.default.readFileSync(partPath);
                assembledSize += part.length;
                fs_1.default.appendFileSync(final, part);
                fs_1.default.unlinkSync(partPath);
            }
            if (assembledSize > maxUploadSize) {
                fs_1.default.rmSync(final, { force: true });
                cleanupAll();
                res.status(400).json({ error: 'Файл превышает допустимый размер' });
                return;
            }
            const targetDir = baseDir;
            fs_1.default.mkdirSync(targetDir, { recursive: true });
            const target = path_1.default.resolve(targetDir, storedName);
            if (!target.startsWith(targetDir + path_1.default.sep)) {
                fs_1.default.rmSync(final, { force: true });
                cleanupAll();
                res.status(400).json({ error: 'Недопустимое имя файла' });
                return;
            }
            await (0, safeMoveFile_1.safeMoveFile)(final, target);
            const diskFile = {
                ...file,
                destination: targetDir,
                filename: storedName,
                path: target,
                size: assembledSize,
                buffer: Buffer.alloc(0),
                originalname: originalName,
            };
            req.files = [diskFile];
            req.file = diskFile;
            try {
                await (0, exports.processUploads)(req, res, () => { });
            }
            catch (error) {
                cleanupAll();
                throw error;
            }
            if (res.headersSent) {
                cleanupAll();
                await (0, uploadFinalizer_1.purgeTemporaryUploads)(req).catch(() => undefined);
                return;
            }
            const bodyWithAttachments = req.body;
            let finalizeResult;
            try {
                finalizeResult = await (0, uploadFinalizer_1.finalizePendingUploads)({
                    req: req,
                    attachments: bodyWithAttachments.attachments ?? [],
                });
            }
            finally {
                cleanupAll();
            }
            bodyWithAttachments.attachments =
                finalizeResult.attachments;
            const finalAbsolutePath = path_1.default.resolve(uploadsDirAbs, path_1.default.join(String(userId), storedName));
            try {
                await (0, antivirus_1.scanFile)(finalAbsolutePath);
            }
            catch (scanError) {
                await (0, wgLogEngine_1.writeLog)('Повторная проверка файла не выполнена', 'error', {
                    path: finalAbsolutePath,
                    error: scanError.message,
                }).catch(() => undefined);
            }
            if (res.headersSent)
                return;
            const attachment = bodyWithAttachments.attachments?.[0];
            if (!attachment) {
                res.sendStatus(500);
                return;
            }
            await syncAttachmentsForRequest(req, [attachment]);
            res.json(attachment);
            return;
        }
        res.json({ received: idx });
    }
    catch (error) {
        if (cleanupUserId !== undefined && cleanupFileId) {
            releaseChunkUploadDir(cleanupUserId, cleanupFileId);
        }
        await (0, wgLogEngine_1.writeLog)('Не удалось обработать chunk-upload', 'error', {
            error: error.message,
            fileId: cleanupFileId,
            userId: cleanupUserId,
        }).catch(() => undefined);
        res.sendStatus(500);
    }
};
exports.handleChunks = handleChunks;
router.post('/upload-chunk', ...requireTaskCreationRights, chunkUploadMiddleware, exports.handleChunks);
router.post('/upload-inline', ...requireTaskCreationRights, inlineUpload, handleInlineUpload);
function normalizeUserId(value) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    return undefined;
}
const normalizeArrays = (req, _res, next) => {
    const body = req.body;
    const requestUserId = req.user?.id;
    const hasAssignedUserId = body.assigned_user_id !== undefined ||
        body.assignedUserId !== undefined;
    const hasAssignees = body.assignees !== undefined;
    const normalizedId = normalizeUserId(requestUserId);
    if (req.method === 'POST' &&
        !hasAssignedUserId &&
        !hasAssignees &&
        normalizedId &&
        normalizedId.length > 0) {
        body.assigned_user_id = normalizedId;
        body.assignees = [normalizedId];
    }
    const assignedRaw = body.assigned_user_id ?? body.assignedUserId;
    if (assignedRaw !== undefined) {
        const pickValue = Array.isArray(assignedRaw)
            ? assignedRaw.find((item) => item !== null &&
                item !== undefined &&
                !(typeof item === 'string' && item.trim().length === 0))
            : assignedRaw;
        if (pickValue === null ||
            pickValue === undefined ||
            (typeof pickValue === 'string' && pickValue.trim().length === 0)) {
            body.assigned_user_id = null;
            body.assignees = [];
        }
        else {
            const normalized = typeof pickValue === 'string' ? pickValue.trim() : pickValue;
            body.assigned_user_id = normalized;
            body.assignees = [normalized];
        }
    }
    else if (body.assignees !== undefined) {
        const rawAssignees = Array.isArray(body.assignees)
            ? body.assignees
            : [body.assignees];
        const normalizedAssignees = rawAssignees
            .map((item) => (typeof item === 'string' ? item.trim() : item))
            .filter((item) => item !== null &&
            item !== undefined &&
            !(typeof item === 'string' && item.length === 0));
        body.assignees = normalizedAssignees;
    }
    const controllersValue = body.controllers;
    if (controllersValue !== undefined && !Array.isArray(controllersValue)) {
        body.controllers = [controllersValue];
    }
    const attachmentsField = req.body.attachments;
    if (attachmentsField !== undefined) {
        req.body.attachments = readAttachmentsField(attachmentsField);
    }
    next();
};
exports.normalizeArrays = normalizeArrays;
router.get('/', [
    (0, express_validator_1.query)('status').optional().isString(),
    (0, express_validator_1.query)('assignees')
        .optional()
        .custom((value) => Array.isArray(value) || typeof value === 'string'),
    (0, express_validator_1.query)('assignee').optional().isString(),
    (0, express_validator_1.query)('from').optional().isISO8601(),
    (0, express_validator_1.query)('to').optional().isISO8601(),
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1 }),
    (0, express_validator_1.query)('kind').optional().isIn(['task', 'request']),
    (0, express_validator_1.query)('taskType').optional().isString(),
], ctrl.list);
router.get('/executors', [(0, express_validator_1.query)('kind').optional().isIn(['task', 'request'])], ctrl.executors);
router.get('/mentioned', ctrl.mentioned);
router.get('/transport-options', ctrl.transportOptions);
router.get('/report.pdf', [
    (0, express_validator_1.query)('status').optional().isString(),
    (0, express_validator_1.query)('assignees')
        .optional()
        .custom((value) => Array.isArray(value) || typeof value === 'string'),
    (0, express_validator_1.query)('assignee').optional().isString(),
    (0, express_validator_1.query)('from').optional().isISO8601(),
    (0, express_validator_1.query)('to').optional().isISO8601(),
    (0, express_validator_1.query)('kind').optional().isIn(['task', 'request']),
    (0, express_validator_1.query)('taskType').optional().isString(),
], validate_1.handleValidation, downloadPdfHandler);
router.get('/report.xlsx', [
    (0, express_validator_1.query)('status').optional().isString(),
    (0, express_validator_1.query)('assignees')
        .optional()
        .custom((value) => Array.isArray(value) || typeof value === 'string'),
    (0, express_validator_1.query)('assignee').optional().isString(),
    (0, express_validator_1.query)('from').optional().isISO8601(),
    (0, express_validator_1.query)('to').optional().isISO8601(),
    (0, express_validator_1.query)('kind').optional().isIn(['task', 'request']),
    (0, express_validator_1.query)('taskType').optional().isString(),
], validate_1.handleValidation, downloadExcelHandler);
router.get('/report/summary', [
    (0, express_validator_1.query)('from').optional().isISO8601(),
    (0, express_validator_1.query)('to').optional().isISO8601(),
    (0, express_validator_1.query)('kind').optional().isIn(['task', 'request']),
], ctrl.summary);
router.get('/report/chart', [
    (0, express_validator_1.query)('from').optional().isISO8601(),
    (0, express_validator_1.query)('to').optional().isISO8601(),
    (0, express_validator_1.query)('kind').optional().isIn(['task', 'request']),
], ctrl.chart);
router.get('/:id', 
// Приводим лимитер к типу Express 5
detailLimiter, (0, express_validator_1.param)('id').isMongoId(), ctrl.detail);
router.post('/requests', upload.any(), exports.processUploads, exports.normalizeArrays, ...form_1.taskFormValidators, ...(0, validateDto_1.default)(tasks_dto_1.CreateTaskDto), ...ctrl.createRequest);
router.post('/', ...requireTaskCreationRights, upload.any(), exports.processUploads, exports.normalizeArrays, ...form_1.taskFormValidators, ...(0, validateDto_1.default)(tasks_dto_1.CreateTaskDto), ...ctrl.create);
router.patch('/:id', (0, express_validator_1.param)('id').isMongoId(), upload.any(), taskAccess_1.default, exports.processUploads, exports.normalizeArrays, ...(0, validateDto_1.default)(tasks_dto_1.UpdateTaskDto), ...ctrl.update);
router.patch('/:id/time', (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_MANAGER), roles_guard_1.default, (0, express_validator_1.param)('id').isMongoId(), ...(0, validateDto_1.default)(tasks_dto_1.AddTimeDto), taskAccess_1.default, ...ctrl.addTime);
router.delete('/:id', (0, express_validator_1.param)('id').isMongoId(), (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_TASK_DELETE), // удаление только для уровня 8
roles_guard_1.default, taskAccess_1.default, ctrl.remove);
router.post('/bulk', (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_MANAGER), roles_guard_1.default, ...(0, validateDto_1.default)(tasks_dto_1.BulkStatusDto), ...ctrl.bulk);
exports.default = router;
