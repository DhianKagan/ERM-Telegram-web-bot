"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageCleanupCron = exports.storageCleanupRetentionDays = exports.uploadsDir = void 0;
// Конфигурация каталога загрузок
// Модули: path
const path_1 = __importDefault(require("path"));
const resolvePositiveInteger = (source, fallback) => {
    if (!source)
        return fallback;
    const parsed = Number.parseInt(source.trim(), 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
};
exports.uploadsDir = path_1.default.resolve(process.env.STORAGE_DIR || path_1.default.join('apps', 'api', 'uploads'));
exports.storageCleanupRetentionDays = resolvePositiveInteger(process.env.STORAGE_ORPHAN_RETENTION_DAYS, 30);
exports.storageCleanupCron = (process.env.STORAGE_CLEANUP_CRON || '30 2 * * *').trim() || '30 2 * * *';
