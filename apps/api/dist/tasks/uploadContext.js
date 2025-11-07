"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearUploadContext = exports.getUploadContext = exports.ensureUploadContext = exports.getTempUploadsRoot = void 0;
// Управление временным контекстом загрузок задач.
// Основные модули: node:os, node:path, node:crypto, types/request.
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const tempUploadsRoot = node_path_1.default.join(node_os_1.default.tmpdir(), 'erm-api-uploads');
const UPLOAD_CONTEXT_FIELD = Symbol('uploadContext');
const getTempUploadsRoot = () => tempUploadsRoot;
exports.getTempUploadsRoot = getTempUploadsRoot;
const ensureUploadContext = (req, userId) => {
    const target = req;
    if (target[UPLOAD_CONTEXT_FIELD]) {
        return target[UPLOAD_CONTEXT_FIELD];
    }
    const uploadId = (0, node_crypto_1.randomBytes)(12).toString('hex');
    const dir = node_path_1.default.join(tempUploadsRoot, String(userId), uploadId);
    target[UPLOAD_CONTEXT_FIELD] = { id: uploadId, dir, userId };
    return target[UPLOAD_CONTEXT_FIELD];
};
exports.ensureUploadContext = ensureUploadContext;
const getUploadContext = (req) => {
    const target = req;
    return target[UPLOAD_CONTEXT_FIELD];
};
exports.getUploadContext = getUploadContext;
const clearUploadContext = (req) => {
    const target = req;
    if (target[UPLOAD_CONTEXT_FIELD]) {
        delete target[UPLOAD_CONTEXT_FIELD];
    }
};
exports.clearUploadContext = clearUploadContext;
