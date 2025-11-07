"use strict";
// Лимиты вложений на пользователя
// Модули: none
Object.defineProperty(exports, "__esModule", { value: true });
exports.staleUserFilesGraceMinutes = exports.maxUserStorage = exports.maxUserFiles = void 0;
const parsePositiveNumber = (source, fallback) => {
    if (!source)
        return fallback;
    const trimmed = source.trim();
    if (!trimmed)
        return fallback;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
};
exports.maxUserFiles = parsePositiveNumber(process.env.USER_FILES_MAX_COUNT, 20);
exports.maxUserStorage = parsePositiveNumber(process.env.USER_FILES_MAX_SIZE, 50 * 1024 * 1024);
exports.staleUserFilesGraceMinutes = parsePositiveNumber(process.env.USER_FILES_STALE_GRACE_MINUTES, 60);
