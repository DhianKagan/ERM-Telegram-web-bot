"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAttachmentsFromCommentHtml = exports.extractFileIdFromUrl = void 0;
exports.coerceAttachments = coerceAttachments;
exports.extractAttachmentIds = extractAttachmentIds;
// Утилиты для работы со вложениями задач
// Основные модули: json5, mongoose, db/model
const json5_1 = __importDefault(require("json5"));
const mongoose_1 = require("mongoose");
const jsonParsers = [JSON.parse, json5_1.default.parse];
const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const toNumber = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return undefined;
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return undefined;
};
const toDate = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return undefined;
};
const normalizeAttachmentRecord = (input) => {
    const urlRaw = typeof input.url === 'string' ? input.url.trim() : '';
    if (!urlRaw) {
        return null;
    }
    const nameRaw = input.name;
    const name = typeof nameRaw === 'string' && nameRaw.trim()
        ? nameRaw.trim()
        : urlRaw.split('/').pop() || urlRaw;
    const thumbnailUrl = typeof input.thumbnailUrl === 'string' && input.thumbnailUrl.trim()
        ? input.thumbnailUrl
        : undefined;
    const uploadedBy = toNumber(input.uploadedBy);
    const uploadedAt = toDate(input.uploadedAt);
    const type = typeof input.type === 'string' && input.type.trim()
        ? input.type
        : 'application/octet-stream';
    const size = toNumber(input.size);
    const normalized = {
        name,
        url: urlRaw,
        thumbnailUrl,
        uploadedBy,
        uploadedAt,
        type,
        size,
    };
    return normalized;
};
function parseAttachmentLike(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return [];
        }
        for (const parse of jsonParsers) {
            try {
                const parsed = parse(trimmed);
                const result = parseAttachmentLike(parsed);
                if (result) {
                    return result;
                }
            }
            catch {
                // пробуем следующий парсер
            }
        }
        return [];
    }
    if (Array.isArray(value)) {
        return value
            .filter(isPlainObject)
            .map((item) => normalizeAttachmentRecord(item))
            .filter((item) => item !== null);
    }
    if (isPlainObject(value)) {
        const single = normalizeAttachmentRecord(value);
        return single ? [single] : [];
    }
    return [];
}
function coerceAttachments(value) {
    return parseAttachmentLike(value);
}
const htmlEntityDecode = (value) => value
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&');
const OBJECT_ID_LENGTH = 24;
const normalizeObjectIdCandidate = (candidate) => {
    const trimmed = candidate.trim();
    if (trimmed.length !== OBJECT_ID_LENGTH) {
        return null;
    }
    if (!mongoose_1.Types.ObjectId.isValid(trimmed)) {
        return null;
    }
    return trimmed.toLowerCase();
};
const collectObjectIds = (source) => {
    const result = new Set();
    const hexPattern = /[0-9a-fA-F]{24}/g;
    let match;
    while ((match = hexPattern.exec(source)) !== null) {
        const normalized = normalizeObjectIdCandidate(match[0]);
        if (normalized) {
            result.add(normalized);
        }
    }
    return result;
};
const collectIdsFromAttribute = (value) => {
    const decoded = htmlEntityDecode(value);
    const tokens = decoded
        .split(/[,;\s]+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 0);
    const result = new Set();
    tokens.forEach((token) => {
        const normalized = normalizeObjectIdCandidate(token);
        if (normalized) {
            result.add(normalized);
        }
    });
    return result;
};
const extractIdsFromCommentHtml = (html) => {
    var _a, _b;
    if (!html.trim()) {
        return [];
    }
    const decoded = htmlEntityDecode(html);
    const ids = new Set();
    const urlPattern = /\/api\/v1\/files\/([0-9a-fA-F]{24})/g;
    let match;
    while ((match = urlPattern.exec(decoded)) !== null) {
        const normalized = normalizeObjectIdCandidate((_a = match[1]) !== null && _a !== void 0 ? _a : '');
        if (normalized) {
            ids.add(normalized);
        }
    }
    const attributePattern = /data-(?:file|attachment)(?:-ids?)?=(["'])(.*?)\1/gi;
    while ((match = attributePattern.exec(decoded)) !== null) {
        const attributeIds = collectIdsFromAttribute((_b = match[2]) !== null && _b !== void 0 ? _b : '');
        attributeIds.forEach((id) => ids.add(id));
    }
    if (ids.size === 0) {
        const fallback = collectObjectIds(decoded);
        fallback.forEach((id) => ids.add(id));
    }
    return Array.from(ids.values());
};
const extractFileIdFromUrl = (url) => {
    if (typeof url !== 'string') {
        return null;
    }
    const trimmed = url.trim();
    if (!trimmed) {
        return null;
    }
    const [withoutFragment] = trimmed.split('#');
    const [pathPart] = withoutFragment.split('?');
    if (!pathPart) {
        return null;
    }
    const segments = pathPart.split('/').filter(Boolean);
    if (segments.length === 0) {
        return null;
    }
    const last = segments[segments.length - 1];
    const normalized = normalizeObjectIdCandidate(last);
    return normalized !== null && normalized !== void 0 ? normalized : null;
};
exports.extractFileIdFromUrl = extractFileIdFromUrl;
const buildAttachmentsFromCommentHtml = (commentHtml, options = {}) => {
    const existing = Array.isArray(options.existing)
        ? options.existing
            .filter((candidate) => Boolean(candidate && typeof candidate.url === 'string'))
            .map((candidate) => ({ ...candidate }))
        : [];
    const seenFileIds = new Set();
    const seenUrls = new Set();
    existing.forEach((attachment) => {
        const url = typeof attachment.url === 'string' ? attachment.url.trim() : '';
        if (url) {
            seenUrls.add(url);
        }
        const fileId = (0, exports.extractFileIdFromUrl)(url);
        if (fileId) {
            seenFileIds.add(fileId);
        }
    });
    const source = typeof commentHtml === 'string' ? commentHtml : '';
    const ids = extractIdsFromCommentHtml(source);
    ids.forEach((id) => {
        if (seenFileIds.has(id)) {
            return;
        }
        const url = `/api/v1/files/${id}`;
        if (seenUrls.has(url)) {
            return;
        }
        seenFileIds.add(id);
        seenUrls.add(url);
        existing.push({
            name: '',
            url,
            uploadedBy: undefined,
            uploadedAt: undefined,
            type: undefined,
            size: undefined,
        });
    });
    return existing;
};
exports.buildAttachmentsFromCommentHtml = buildAttachmentsFromCommentHtml;
/**
 * Извлекает ObjectId файлов из массива вложений задачи.
 * Допускает URL вида `/api/v1/files/<id>` с дополнительными параметрами.
 */
function extractAttachmentIds(attachments) {
    if (!Array.isArray(attachments) || attachments.length === 0) {
        return [];
    }
    const result = [];
    const seen = new Set();
    attachments.forEach((attachment) => {
        if (!attachment || typeof attachment.url !== 'string')
            return;
        const trimmed = attachment.url.trim();
        if (!trimmed)
            return;
        const [withoutFragment] = trimmed.split('#');
        const [pathPart] = withoutFragment.split('?');
        if (!pathPart)
            return;
        const segments = pathPart.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        if (!last || !mongoose_1.Types.ObjectId.isValid(last))
            return;
        const key = last.toLowerCase();
        if (seen.has(key))
            return;
        seen.add(key);
        result.push(new mongoose_1.Types.ObjectId(last));
    });
    return result;
}
