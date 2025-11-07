"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEMP_URL_PREFIX = exports.purgeTemporaryUploads = exports.finalizePendingUploads = exports.isTemporaryUrl = void 0;
// Финализация временных загрузок задач.
// Основные модули: node:path, node:fs/promises, mongoose, utils/requestUploads, db/model.
const node_path_1 = __importDefault(require("node:path"));
const promises_1 = __importDefault(require("node:fs/promises"));
const mongoose_1 = require("mongoose");
const requestUploads_1 = require("../utils/requestUploads");
const uploadContext_1 = require("./uploadContext");
const storage_1 = require("../config/storage");
const model_1 = require("../db/model");
const fileUrls_1 = require("../utils/fileUrls");
const wgLogEngine_1 = require("../services/wgLogEngine");
const uploadsDirAbs = node_path_1.default.resolve(storage_1.uploadsDir);
const TEMP_URL_PREFIX = 'temp://';
exports.TEMP_URL_PREFIX = TEMP_URL_PREFIX;
const toObjectId = (value) => {
    if (!value)
        return undefined;
    if (value instanceof mongoose_1.Types.ObjectId) {
        return value;
    }
    if (mongoose_1.Types.ObjectId.isValid(value)) {
        return new mongoose_1.Types.ObjectId(value);
    }
    return undefined;
};
const ensureWithin = (base, target) => {
    const normalizedBase = node_path_1.default.resolve(base);
    const resolved = node_path_1.default.resolve(target);
    if (!resolved.startsWith(normalizedBase + node_path_1.default.sep)) {
        throw new Error('INVALID_PATH');
    }
    return resolved;
};
const relativeToUploads = (target) => {
    const absolute = node_path_1.default.resolve(target);
    const relative = node_path_1.default.relative(uploadsDirAbs, absolute);
    if (relative.startsWith('..') ||
        node_path_1.default.isAbsolute(relative) ||
        relative.length === 0) {
        return undefined;
    }
    return relative.split(node_path_1.default.sep).join('/');
};
const cleanupMovedFiles = async (paths) => {
    await Promise.all(paths.map((p) => promises_1.default.unlink(p).catch(() => undefined)));
};
const cleanupDirectories = async (dirs) => {
    const unique = Array.from(new Set(Array.from(dirs).filter(Boolean)));
    await Promise.all(unique.map((dir) => promises_1.default.rm(dir, { recursive: true, force: true }).catch(() => undefined)));
};
const isTemporaryUrl = (value) => typeof value === 'string' && value.startsWith(TEMP_URL_PREFIX);
exports.isTemporaryUrl = isTemporaryUrl;
const finalizePendingUploads = async (options) => {
    const { req } = options;
    const pending = (0, requestUploads_1.consumePendingUploads)(req);
    if (pending.length === 0) {
        return {
            attachments: options.attachments ? [...options.attachments] : [],
            created: [],
            fileIds: [],
        };
    }
    const directories = new Set();
    const replacements = new Map();
    const createdIds = [];
    const createdAttachments = [];
    const movedPaths = [];
    const movedThumbnails = [];
    const normalizedTaskId = toObjectId(options.taskId);
    const normalizedDraftId = toObjectId(options.draftId);
    let normalizedAttachments = [];
    if (Array.isArray(options.attachments)) {
        normalizedAttachments = options.attachments.map((item) => ({ ...item }));
    }
    else if (normalizedTaskId) {
        const current = await model_1.Task.findById(normalizedTaskId)
            .select(['attachments'])
            .lean();
        if (current?.attachments && Array.isArray(current.attachments)) {
            normalizedAttachments = current.attachments.map((item) => ({ ...item }));
        }
    }
    try {
        for (const entry of pending) {
            directories.add(entry.tempDir);
            const userDir = node_path_1.default.resolve(uploadsDirAbs, String(entry.userId));
            await promises_1.default.mkdir(userDir, { recursive: true });
            const finalPath = ensureWithin(userDir, node_path_1.default.join(userDir, node_path_1.default.basename(entry.tempPath)));
            await promises_1.default.rename(entry.tempPath, finalPath);
            movedPaths.push(finalPath);
            let thumbnailRelative;
            let thumbnailFinalPath;
            if (entry.tempThumbnailPath) {
                const thumbTarget = ensureWithin(userDir, node_path_1.default.join(userDir, node_path_1.default.basename(entry.tempThumbnailPath)));
                try {
                    await promises_1.default.rename(entry.tempThumbnailPath, thumbTarget);
                    thumbnailFinalPath = thumbTarget;
                    movedThumbnails.push(thumbTarget);
                    thumbnailRelative = relativeToUploads(thumbTarget);
                }
                catch (error) {
                    const err = error;
                    if (err.code !== 'ENOENT') {
                        throw error;
                    }
                }
            }
            const relative = relativeToUploads(finalPath);
            if (!relative) {
                throw new Error('INVALID_PATH');
            }
            const doc = await model_1.File.create({
                userId: entry.userId,
                name: entry.originalName,
                path: relative,
                thumbnailPath: thumbnailRelative,
                type: entry.mimeType,
                size: entry.size,
                taskId: normalizedTaskId,
                draftId: normalizedDraftId,
            });
            createdIds.push(String(doc._id));
            const attachment = {
                name: entry.originalName,
                url: (0, fileUrls_1.buildFileUrl)(doc._id),
                thumbnailUrl: thumbnailRelative ? (0, fileUrls_1.buildThumbnailUrl)(doc._id) : undefined,
                uploadedBy: entry.userId,
                uploadedAt: new Date(),
                type: entry.mimeType,
                size: entry.size,
            };
            createdAttachments.push(attachment);
            replacements.set(entry.placeholder, attachment);
            await (0, wgLogEngine_1.writeLog)('Загружен файл', 'info', {
                userId: entry.userId,
                name: entry.originalName,
            });
        }
    }
    catch (error) {
        await cleanupMovedFiles(movedPaths);
        await cleanupMovedFiles(movedThumbnails);
        await cleanupDirectories(directories);
        (0, requestUploads_1.clearPendingUploads)(req);
        (0, uploadContext_1.clearUploadContext)(req);
        throw error;
    }
    await cleanupDirectories(directories);
    (0, uploadContext_1.clearUploadContext)(req);
    const applied = normalizedAttachments.map((item) => {
        if (typeof item.url === 'string' && replacements.has(item.url)) {
            const replacement = replacements.get(item.url);
            return { ...item, ...replacement };
        }
        return item;
    });
    replacements.forEach((attachment, key) => {
        const exists = applied.some((item) => typeof item.url === 'string' && item.url === attachment.url);
        if (!exists) {
            applied.push({ ...attachment });
        }
        replacements.delete(key);
    });
    if (normalizedTaskId) {
        await model_1.Task.updateOne({ _id: normalizedTaskId }, { attachments: applied }).exec();
    }
    return {
        attachments: applied,
        created: createdAttachments,
        fileIds: createdIds,
    };
};
exports.finalizePendingUploads = finalizePendingUploads;
const purgeTemporaryUploads = async (req) => {
    const pending = (0, requestUploads_1.consumePendingUploads)(req);
    if (pending.length === 0) {
        (0, uploadContext_1.clearUploadContext)(req);
        return;
    }
    const directories = new Set();
    await Promise.all(pending.map(async (entry) => {
        directories.add(entry.tempDir);
        await promises_1.default.unlink(entry.tempPath).catch(() => undefined);
        if (entry.tempThumbnailPath) {
            await promises_1.default.unlink(entry.tempThumbnailPath).catch(() => undefined);
        }
    }));
    await cleanupDirectories(directories);
    (0, uploadContext_1.clearUploadContext)(req);
};
exports.purgeTemporaryUploads = purgeTemporaryUploads;
