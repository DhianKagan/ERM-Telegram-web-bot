"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.moveFile = void 0;
// Назначение файла: безопасное перемещение файлов с учётом ограничений файловой системы.
// Основные модули: node:fs/promises, node:path
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const CROSS_DEVICE_ERROR_CODE = 'EXDEV';
const ensureDirectory = async (targetPath) => {
    const dir = node_path_1.default.dirname(targetPath);
    await promises_1.default.mkdir(dir, { recursive: true });
};
const moveAcrossDevices = async (source, destination) => {
    await ensureDirectory(destination);
    await promises_1.default.copyFile(source, destination);
    await promises_1.default.unlink(source);
};
const moveFile = async (source, destination) => {
    try {
        await ensureDirectory(destination);
        await promises_1.default.rename(source, destination);
    }
    catch (error) {
        const err = error;
        if (err.code === CROSS_DEVICE_ERROR_CODE) {
            await moveAcrossDevices(source, destination);
            return;
        }
        throw error;
    }
};
exports.moveFile = moveFile;
