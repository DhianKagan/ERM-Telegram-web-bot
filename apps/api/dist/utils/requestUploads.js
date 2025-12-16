"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearUploadedFiles = exports.cleanupUploadedFiles = exports.discardPendingUploads = exports.clearPendingUploads = exports.peekPendingUploads = exports.consumePendingUploads = exports.appendPendingUpload = exports.getUploadedFileIds = exports.registerUploadedFile = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const dataStorage_1 = require("../services/dataStorage");
const wgLogEngine_1 = require("../services/wgLogEngine");
const UPLOADED_FILE_IDS_FIELD = Symbol('uploadedFileIds');
const PENDING_UPLOADS_FIELD = Symbol('pendingUploads');
const getMutableList = (req) => {
    if (!req[UPLOADED_FILE_IDS_FIELD]) {
        req[UPLOADED_FILE_IDS_FIELD] = [];
    }
    return req[UPLOADED_FILE_IDS_FIELD];
};
const registerUploadedFile = (req, fileId) => {
    if (!fileId)
        return;
    const target = req;
    const list = getMutableList(target);
    if (!list.includes(fileId)) {
        list.push(fileId);
    }
};
exports.registerUploadedFile = registerUploadedFile;
const getUploadedFileIds = (req) => {
    const target = req;
    const list = target[UPLOADED_FILE_IDS_FIELD];
    return Array.isArray(list) ? [...list] : [];
};
exports.getUploadedFileIds = getUploadedFileIds;
const getPendingMutableList = (req) => {
    if (!req[PENDING_UPLOADS_FIELD]) {
        req[PENDING_UPLOADS_FIELD] = [];
    }
    return req[PENDING_UPLOADS_FIELD];
};
const appendPendingUpload = (req, entry) => {
    if (!entry.placeholder || !entry.tempPath) {
        return;
    }
    const target = req;
    const list = getPendingMutableList(target);
    list.push({ ...entry });
};
exports.appendPendingUpload = appendPendingUpload;
const consumePendingUploads = (req) => {
    const target = req;
    const list = target[PENDING_UPLOADS_FIELD];
    target[PENDING_UPLOADS_FIELD] = [];
    return Array.isArray(list) ? list.map((item) => ({ ...item })) : [];
};
exports.consumePendingUploads = consumePendingUploads;
const peekPendingUploads = (req) => {
    const target = req;
    const list = target[PENDING_UPLOADS_FIELD];
    return Array.isArray(list) ? list.map((item) => ({ ...item })) : [];
};
exports.peekPendingUploads = peekPendingUploads;
const clearPendingUploads = (req) => {
    const target = req;
    target[PENDING_UPLOADS_FIELD] = [];
};
exports.clearPendingUploads = clearPendingUploads;
const cleanupPendingEntries = async (entries) => {
    if (!Array.isArray(entries) || entries.length === 0) {
        return;
    }
    const uniqueDirs = new Set();
    await Promise.all(entries.map(async (entry) => {
        if (entry.tempPath) {
            await promises_1.default.unlink(entry.tempPath).catch(() => undefined);
        }
        if (entry.tempThumbnailPath) {
            await promises_1.default.unlink(entry.tempThumbnailPath).catch(() => undefined);
        }
        if (entry.tempDir) {
            uniqueDirs.add(entry.tempDir);
        }
    }));
    await Promise.all(Array.from(uniqueDirs).map(async (dir) => {
        if (!dir)
            return;
        try {
            await promises_1.default.rm(dir, { recursive: true, force: true });
        }
        catch {
            /* игнорируем сбой удаления каталога */
        }
    }));
};
const discardPendingUploads = async (req) => {
    const entries = (0, exports.consumePendingUploads)(req);
    await cleanupPendingEntries(entries);
};
exports.discardPendingUploads = discardPendingUploads;
const cleanupUploadedFiles = async (req) => {
    await (0, exports.discardPendingUploads)(req);
    const target = req;
    const list = target[UPLOADED_FILE_IDS_FIELD];
    if (!Array.isArray(list) || list.length === 0) {
        return;
    }
    target[UPLOADED_FILE_IDS_FIELD] = [];
    const uniqueIds = Array.from(new Set(list.filter(Boolean)));
    await Promise.all(uniqueIds.map(async (id) => {
        try {
            await (0, dataStorage_1.deleteFile)(id);
        }
        catch (error) {
            const err = error;
            if (err.code === 'ENOENT') {
                return;
            }
            await (0, wgLogEngine_1.writeLog)('Не удалось удалить временный файл запроса', 'error', {
                fileId: id,
                error: (err === null || err === void 0 ? void 0 : err.message) || String(error),
            }).catch(() => undefined);
        }
    }));
};
exports.cleanupUploadedFiles = cleanupUploadedFiles;
const clearUploadedFiles = (req) => {
    const target = req;
    target[UPLOADED_FILE_IDS_FIELD] = [];
};
exports.clearUploadedFiles = clearUploadedFiles;
