"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeMoveFile = void 0;
// Безопасное перемещение файлов между файловыми системами.
// Основные модули: node:path, node:fs/promises.
const node_path_1 = require("node:path");
const promises_1 = require("node:fs/promises");
const safeMoveFile = async (src, dest) => {
    await (0, promises_1.mkdir)((0, node_path_1.dirname)(dest), { recursive: true });
    await (0, promises_1.copyFile)(src, dest);
    try {
        await (0, promises_1.unlink)(src);
    }
    catch (error) {
        const err = error;
        if (err.code !== 'ENOENT') {
            throw err;
        }
    }
};
exports.safeMoveFile = safeMoveFile;
