"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanFile = scanFile;
// Сканирование файлов на вирусы
// Модули: node:crypto, node:fs/promises, clamdjs, config/antivirus, wgLogEngine
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const clamdjs_1 = __importDefault(require("clamdjs"));
const path_1 = __importDefault(require("path"));
const storage_1 = require("../config/storage");
const antivirus_1 = require("../config/antivirus");
const wgLogEngine_1 = require("./wgLogEngine");
let scanner = null;
let versionInfo = null;
let status = 'idle';
let initPromise = null;
/** Привести путь к POSIX-виду: `\` → `/`, `C:/` → `/` */
const toPosixAbs = (p) => {
    const forward = p.replace(/\\/g, '/');
    return forward.replace(/^[A-Za-z]:\//, '/');
};
const signatureEntries = antivirus_1.antivirusConfig.vendor === 'Signature'
    ? Array.from(new Set(antivirus_1.antivirusConfig.signatures)).map((value) => ({
        value,
        buffer: Buffer.from(value, 'utf-8'),
    }))
    : [];
const signatureVersion = antivirus_1.antivirusConfig.vendor === 'Signature'
    ? `SignatureSet/${signatureEntries.length}/${(0, node_crypto_1.createHash)('sha256')
        .update(signatureEntries.map((entry) => entry.value).join('|'))
        .digest('hex')
        .slice(0, 8)}`
    : null;
function isClamConfig(config) {
    return config.vendor === 'ClamAV';
}
function formatError(error) {
    if (error instanceof Error)
        return error.message;
    return typeof error === 'string' ? error : JSON.stringify(error);
}
async function logStatus(nextStatus, metadata = {}) {
    if (status === nextStatus)
        return;
    status = nextStatus;
    const baseMetadata = {
        vendor: antivirus_1.antivirusConfig.vendor,
        version: versionInfo ?? undefined,
        ...(isClamConfig(antivirus_1.antivirusConfig)
            ? {
                host: antivirus_1.antivirusConfig.host,
                port: antivirus_1.antivirusConfig.port,
            }
            : {
                signatures: signatureEntries.length,
                maxFileSize: antivirus_1.antivirusConfig.maxFileSize,
            }),
        ...metadata,
    };
    if (nextStatus === 'available') {
        await (0, wgLogEngine_1.writeLog)('Антивирус активирован', 'info', baseMetadata);
    }
    else if (nextStatus === 'disabled') {
        await (0, wgLogEngine_1.writeLog)('Антивирус отключён', 'warn', baseMetadata);
    }
    else {
        await (0, wgLogEngine_1.writeLog)('Антивирус недоступен', 'warn', baseMetadata);
    }
}
async function ensureScanner() {
    if (!antivirus_1.antivirusConfig.enabled) {
        scanner = null;
        versionInfo = null;
        await logStatus('disabled');
        return;
    }
    if (antivirus_1.antivirusConfig.vendor === 'Signature') {
        versionInfo = signatureVersion;
        await logStatus('available');
        return;
    }
    if (scanner)
        return;
    if (initPromise) {
        await initPromise;
        return;
    }
    initPromise = (async () => {
        try {
            if (!isClamConfig(antivirus_1.antivirusConfig)) {
                throw new Error('Конфигурация ClamAV недоступна');
            }
            const alive = await clamdjs_1.default.ping(antivirus_1.antivirusConfig.host, antivirus_1.antivirusConfig.port, antivirus_1.antivirusConfig.timeout);
            if (!alive) {
                throw new Error('ClamAV не ответил на ping');
            }
            scanner = clamdjs_1.default.createScanner(antivirus_1.antivirusConfig.host, antivirus_1.antivirusConfig.port);
            versionInfo = await clamdjs_1.default
                .version(antivirus_1.antivirusConfig.host, antivirus_1.antivirusConfig.port, antivirus_1.antivirusConfig.timeout)
                .catch(() => null);
            await logStatus('available');
        }
        catch (error) {
            scanner = null;
            versionInfo = null;
            await logStatus('unavailable', { error: formatError(error) });
        }
    })();
    try {
        await initPromise;
    }
    finally {
        initPromise = null;
    }
}
async function scanFile(filePath) {
    const uploadsRoot = path_1.default.resolve(storage_1.uploadsDir);
    // Абсолютный путь на диске (Windows/Unix)
    const normalizedPath = path_1.default.isAbsolute(filePath)
        ? path_1.default.resolve(filePath)
        : path_1.default.resolve(uploadsRoot, filePath);
    // Безопасность: запретить выход за uploads при относительном входе
    if (!path_1.default.isAbsolute(filePath)) {
        const relative = path_1.default.relative(uploadsRoot, normalizedPath);
        if (relative.startsWith('..') || path_1.default.isAbsolute(relative)) {
            throw new Error('INVALID_PATH');
        }
    }
    // POSIX-путь для вызовов и логов (нужен для стабильности тестов и кроссплатформенности)
    const posixPath = toPosixAbs(normalizedPath);
    await ensureScanner();
    // Сигнатурный "офлайн" сканер
    if (antivirus_1.antivirusConfig.vendor === 'Signature') {
        try {
            const fileStat = await (0, promises_1.stat)(normalizedPath);
            if (fileStat.size > antivirus_1.antivirusConfig.maxFileSize) {
                await (0, wgLogEngine_1.writeLog)('Размер файла превышает лимит сигнатурного сканера', 'warn', {
                    path: posixPath,
                    vendor: antivirus_1.antivirusConfig.vendor,
                    size: fileStat.size,
                    maxFileSize: antivirus_1.antivirusConfig.maxFileSize,
                });
                return false;
            }
            const content = await (0, promises_1.readFile)(normalizedPath);
            const match = signatureEntries.find((entry) => content.includes(entry.buffer));
            if (match) {
                await (0, wgLogEngine_1.writeLog)('Обнаружен вирус', 'warn', {
                    path: posixPath,
                    vendor: antivirus_1.antivirusConfig.vendor,
                    signature: match.value,
                });
                return false;
            }
            return true;
        }
        catch (error) {
            await (0, wgLogEngine_1.writeLog)('Ошибка сканирования', 'error', {
                path: posixPath,
                vendor: antivirus_1.antivirusConfig.vendor,
                error: formatError(error),
            });
            return false;
        }
    }
    // ClamAV
    if (!scanner || !isClamConfig(antivirus_1.antivirusConfig))
        return true;
    try {
        const reply = await scanner.scanFile(posixPath, // ВАЖНО: POSIX-вид пути
        antivirus_1.antivirusConfig.timeout, antivirus_1.antivirusConfig.chunkSize);
        const clean = clamdjs_1.default.isCleanReply(reply);
        if (!clean) {
            await (0, wgLogEngine_1.writeLog)('Обнаружен вирус', 'warn', {
                path: posixPath,
                vendor: antivirus_1.antivirusConfig.vendor,
                reply,
            });
        }
        return clean;
    }
    catch (error) {
        // Сбросим состояние, чтобы следующая попытка переинициализировала сканер
        scanner = null;
        versionInfo = null;
        status = 'idle';
        await (0, wgLogEngine_1.writeLog)('Ошибка сканирования', 'error', {
            path: posixPath,
            vendor: antivirus_1.antivirusConfig.vendor,
            error: formatError(error),
        });
        return false;
    }
}
