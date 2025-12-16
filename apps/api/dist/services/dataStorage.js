"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectAttachmentLinks = void 0;
exports.listFiles = listFiles;
exports.getFile = getFile;
exports.deleteFile = deleteFile;
exports.deleteFilesForTask = deleteFilesForTask;
exports.removeDetachedFilesOlderThan = removeDetachedFilesOlderThan;
exports.getFileSyncSnapshot = getFileSyncSnapshot;
// Сервис управления файлами в локальном хранилище
// Модули: fs, path, mongoose
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const mongoose_1 = require("mongoose");
const storage_1 = require("../config/storage");
const model_1 = require("../db/model");
const attachments_1 = require("../utils/attachments");
const fileUrls_1 = require("../utils/fileUrls");
const uploadsDirAbs = path_1.default.resolve(storage_1.uploadsDir);
const resolveWithinUploads = (relative) => {
    const targetPath = path_1.default.resolve(uploadsDirAbs, relative);
    if (!targetPath.startsWith(uploadsDirAbs + path_1.default.sep)) {
        throw new Error('Недопустимое имя файла');
    }
    return targetPath;
};
const unlinkWithinUploads = async (relative) => {
    if (!relative)
        return;
    const target = resolveWithinUploads(relative);
    await fs_1.default.promises.unlink(target).catch((error) => {
        if (error.code !== 'ENOENT')
            throw error;
    });
};
const TASK_URL_SUFFIX = '(?:[/?#].*|$)';
const buildAttachmentQuery = (ids) => {
    if (ids.length === 0)
        return null;
    const orConditions = ids.flatMap((id) => {
        const pattern = new RegExp(`/${id}${TASK_URL_SUFFIX}`, 'i');
        return [
            {
                'attachments.url': {
                    $regex: pattern,
                },
            },
            {
                files: {
                    $elemMatch: {
                        $regex: pattern,
                    },
                },
            },
        ];
    });
    return { $or: orConditions };
};
const HEX_OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const normalizeObjectIdString = (value) => {
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    if (!HEX_OBJECT_ID.test(trimmed))
        return null;
    return mongoose_1.Types.ObjectId.isValid(trimmed) ? trimmed.toLowerCase() : null;
};
const collectIdsFromString = (value) => {
    const normalized = value.trim();
    if (!normalized) {
        return [];
    }
    const result = new Set();
    const fromUrl = (0, attachments_1.extractFileIdFromUrl)(normalized);
    if (fromUrl) {
        result.add(fromUrl.toLowerCase());
    }
    if (normalized.length === 24) {
        const direct = normalizeObjectIdString(normalized);
        if (direct) {
            result.add(direct);
        }
    }
    const matches = normalized.match(/[0-9a-fA-F]{24}/g);
    if (matches) {
        matches.forEach((candidate) => {
            const converted = normalizeObjectIdString(candidate);
            if (converted) {
                result.add(converted);
            }
        });
    }
    return Array.from(result.values());
};
const normalizeLookupId = (value) => {
    var _a;
    if (value instanceof mongoose_1.Types.ObjectId) {
        return value.toHexString();
    }
    if (typeof value === 'string') {
        const direct = normalizeObjectIdString(value);
        if (direct) {
            return direct;
        }
        const extracted = collectIdsFromString(value);
        if (extracted.length > 0) {
            return (_a = extracted[0]) !== null && _a !== void 0 ? _a : null;
        }
    }
    return null;
};
const collectTaskFileReferences = (task) => {
    var _a;
    const references = new Set();
    const attachmentIds = (0, attachments_1.extractAttachmentIds)((_a = task.attachments) !== null && _a !== void 0 ? _a : []);
    attachmentIds.forEach((entry) => references.add(entry.toHexString()));
    if (Array.isArray(task.files)) {
        task.files.forEach((item) => {
            if (typeof item !== 'string')
                return;
            collectIdsFromString(item).forEach((id) => references.add(id));
        });
    }
    return references;
};
const normalizeTitle = (value) => {
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};
const toObjectId = (value) => {
    if (value instanceof mongoose_1.Types.ObjectId) {
        return value;
    }
    if (typeof value === 'string' && mongoose_1.Types.ObjectId.isValid(value)) {
        return new mongoose_1.Types.ObjectId(value);
    }
    return null;
};
const persistTaskLink = async (fileId, taskId) => {
    const normalizedTaskId = toObjectId(taskId);
    if (!normalizedTaskId) {
        console.error('Не удалось сохранить привязку файла к задаче', {
            fileId: String(fileId),
            taskId: String(taskId),
            error: new Error('Некорректный идентификатор задачи'),
        });
        return;
    }
    try {
        await model_1.File.updateOne({ _id: fileId }, { $set: { taskId: normalizedTaskId } }).exec();
    }
    catch (error) {
        console.error('Не удалось сохранить привязку файла к задаче', {
            fileId: String(fileId),
            taskId: normalizedTaskId.toHexString(),
            error,
        });
    }
};
const collectAttachmentLinks = async (candidates) => {
    const normalizedCandidates = candidates
        .map((candidate) => ({
        id: normalizeLookupId(candidate.id),
        hasTask: candidate.hasTask,
    }))
        .filter((candidate) => candidate.id !== null);
    const pendingIds = normalizedCandidates
        .filter((file) => !file.hasTask)
        .map((file) => file.id);
    if (!pendingIds.length) {
        return new Map();
    }
    const query = buildAttachmentQuery(pendingIds);
    if (!query) {
        return new Map();
    }
    const tasks = await model_1.Task.find(query)
        .select(['_id', 'task_number', 'title', 'attachments', 'files'])
        .lean();
    const lookup = new Map();
    if (!tasks.length)
        return lookup;
    const available = new Set(pendingIds);
    tasks.forEach((task) => {
        const references = collectTaskFileReferences(task);
        references.forEach((key) => {
            if (!available.has(key) || lookup.has(key))
                return;
            lookup.set(key, {
                taskId: String(task._id),
                number: task.task_number,
                title: task.title,
            });
        });
    });
    return lookup;
};
exports.collectAttachmentLinks = collectAttachmentLinks;
async function listFiles(filters = {}) {
    var _a;
    try {
        const query = {};
        if (filters.userId !== undefined)
            query.userId = filters.userId;
        if (typeof filters.type === 'string')
            query.type = { $eq: filters.type };
        const files = await model_1.File.find(query).lean();
        const taskIds = files
            .map((file) => file.taskId)
            .filter((id) => Boolean(id));
        const candidates = files
            .map((file) => {
            const normalizedId = normalizeLookupId(file._id);
            if (!normalizedId) {
                return null;
            }
            return {
                id: normalizedId,
                hasTask: Boolean(file.taskId),
            };
        })
            .filter((candidate) => candidate !== null);
        const attachmentsLookup = await (0, exports.collectAttachmentLinks)(candidates);
        const taskMap = new Map();
        if (taskIds.length > 0) {
            const tasks = await model_1.Task.find({ _id: { $in: taskIds } })
                .select(['_id', 'task_number', 'title'])
                .lean();
            tasks.forEach((task) => {
                taskMap.set(String(task._id), {
                    title: task.title,
                    number: task.task_number,
                });
            });
        }
        const updates = [];
        const result = [];
        for (const f of files) {
            let taskId = f.taskId ? String(f.taskId) : undefined;
            let taskMeta = taskId ? taskMap.get(taskId) : undefined;
            if (!taskId) {
                const normalizedFileId = normalizeLookupId(f._id);
                const fallback = normalizedFileId
                    ? attachmentsLookup.get(normalizedFileId)
                    : undefined;
                if (fallback) {
                    taskId = fallback.taskId;
                    taskMeta = { title: fallback.title, number: fallback.number };
                    updates.push(persistTaskLink(f._id, fallback.taskId));
                }
            }
            result.push({
                id: String(f._id),
                taskId,
                taskNumber: (_a = taskMeta === null || taskMeta === void 0 ? void 0 : taskMeta.number) !== null && _a !== void 0 ? _a : undefined,
                taskTitle: normalizeTitle(taskMeta === null || taskMeta === void 0 ? void 0 : taskMeta.title),
                userId: f.userId,
                name: f.name,
                path: f.path,
                thumbnailUrl: f.thumbnailPath ? (0, fileUrls_1.buildThumbnailUrl)(f._id) : undefined,
                type: f.type,
                size: f.size,
                uploadedAt: f.uploadedAt,
                url: (0, fileUrls_1.buildFileUrl)(f._id),
                previewUrl: (0, fileUrls_1.buildInlineFileUrl)(f._id),
            });
        }
        if (updates.length > 0) {
            await Promise.all(updates);
        }
        return result;
    }
    catch {
        return [];
    }
}
async function getFile(id) {
    var _a;
    const doc = await model_1.File.findById(id).lean();
    if (!doc) {
        return null;
    }
    let taskId = doc.taskId ? String(doc.taskId) : undefined;
    let taskMeta = null;
    if (taskId) {
        taskMeta = await model_1.Task.findById(doc.taskId)
            .select(['task_number', 'title'])
            .lean();
    }
    else {
        const fallbackQuery = buildAttachmentQuery([String(doc._id)]);
        if (fallbackQuery) {
            const fallback = await model_1.Task.findOne(fallbackQuery)
                .select(['_id', 'task_number', 'title', 'attachments', 'files'])
                .lean();
            if (fallback) {
                const references = collectTaskFileReferences(fallback);
                const key = normalizeLookupId(doc._id);
                if (key && references.has(key)) {
                    taskId = String(fallback._id);
                    taskMeta = fallback;
                    await persistTaskLink(doc._id, fallback._id);
                }
            }
        }
    }
    return {
        id: String(doc._id),
        taskId,
        taskNumber: (_a = taskMeta === null || taskMeta === void 0 ? void 0 : taskMeta.task_number) !== null && _a !== void 0 ? _a : undefined,
        taskTitle: normalizeTitle(taskMeta === null || taskMeta === void 0 ? void 0 : taskMeta.title),
        userId: doc.userId,
        name: doc.name,
        path: doc.path,
        thumbnailUrl: doc.thumbnailPath ? (0, fileUrls_1.buildThumbnailUrl)(doc._id) : undefined,
        type: doc.type,
        size: doc.size,
        uploadedAt: doc.uploadedAt,
        url: (0, fileUrls_1.buildFileUrl)(doc._id),
        previewUrl: (0, fileUrls_1.buildInlineFileUrl)(doc._id),
    };
}
async function deleteFile(identifier) {
    const query = /^[0-9a-fA-F]{24}$/.test(identifier)
        ? { _id: identifier }
        : { path: identifier };
    const file = await model_1.File.findOneAndDelete(query).lean();
    if (!file) {
        const err = new Error('Файл не найден');
        err.code = 'ENOENT';
        throw err;
    }
    await unlinkWithinUploads(file.path);
    await unlinkWithinUploads(file.thumbnailPath);
    let updatedAttachments;
    let taskIdHex;
    if (file.taskId) {
        taskIdHex =
            typeof file.taskId === 'string'
                ? file.taskId
                : file.taskId instanceof mongoose_1.Types.ObjectId
                    ? file.taskId.toHexString()
                    : undefined;
        const fileUrl = (0, fileUrls_1.buildFileUrl)(file._id);
        const inlineUrl = (0, fileUrls_1.buildInlineFileUrl)(file._id);
        const urlVariants = Array.from(new Set([fileUrl, inlineUrl, `/api/v1/files/${file._id}`]));
        const updatedTask = await model_1.Task.findByIdAndUpdate(file.taskId, {
            $pull: {
                attachments: { url: { $in: urlVariants } },
                files: { $in: urlVariants },
            },
        }, { new: true, projection: { attachments: 1 } })
            .lean()
            .exec();
        if ((updatedTask === null || updatedTask === void 0 ? void 0 : updatedTask.attachments) && Array.isArray(updatedTask.attachments)) {
            updatedAttachments = updatedTask.attachments;
        }
    }
    if (taskIdHex) {
        return { taskId: taskIdHex, attachments: updatedAttachments };
    }
    return undefined;
}
async function deleteFilesForTask(taskId, extraFileIds = []) {
    const normalizedTaskId = typeof taskId === 'string' ? new mongoose_1.Types.ObjectId(taskId) : taskId;
    const uniqueExtraIds = Array.from(new Set(extraFileIds.map((id) => id.toHexString()))).map((id) => new mongoose_1.Types.ObjectId(id));
    const orConditions = [
        { taskId: normalizedTaskId },
    ];
    if (uniqueExtraIds.length > 0) {
        orConditions.push({ _id: { $in: uniqueExtraIds } });
    }
    const filter = orConditions.length === 1 ? orConditions[0] : { $or: orConditions };
    const files = await model_1.File.find(filter).lean();
    if (files.length === 0)
        return;
    await Promise.all(files.map(async (file) => {
        await unlinkWithinUploads(file.path);
        await unlinkWithinUploads(file.thumbnailPath);
    }));
    await model_1.File.deleteMany({ _id: { $in: files.map((file) => file._id) } }).exec();
}
const detachedCleanupFilter = {
    $and: [
        { $or: [{ taskId: null }, { taskId: { $exists: false } }] },
        { $or: [{ draftId: null }, { draftId: { $exists: false } }] },
    ],
};
async function removeDetachedFilesOlderThan(cutoff) {
    const cutoffTime = cutoff.getTime();
    if (!Number.isFinite(cutoffTime)) {
        return 0;
    }
    const filter = {
        ...detachedCleanupFilter,
        uploadedAt: { $lte: new Date(cutoffTime) },
    };
    const candidates = await model_1.File.find(filter)
        .select(['_id', 'path', 'thumbnailPath'])
        .lean();
    if (candidates.length === 0) {
        return 0;
    }
    await Promise.all(candidates.map(async (file) => {
        await unlinkWithinUploads(file.path);
        await unlinkWithinUploads(file.thumbnailPath);
    }));
    await model_1.File.deleteMany({
        _id: { $in: candidates.map((file) => file._id) },
    }).exec();
    return candidates.length;
}
async function getFileSyncSnapshot() {
    const [totalFiles, linkedFiles] = await Promise.all([
        model_1.File.countDocuments().exec(),
        model_1.File.countDocuments({ taskId: { $ne: null } }).exec(),
    ]);
    return {
        totalFiles,
        linkedFiles,
        detachedFiles: Math.max(totalFiles - linkedFiles, 0),
    };
}
