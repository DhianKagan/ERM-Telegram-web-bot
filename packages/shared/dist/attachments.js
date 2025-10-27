"use strict";
// Назначение: общие утилиты для работы со вложениями.
// Основные модули: отсутствуют
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAttachmentsFromCommentHtml = exports.extractFileIdFromUrl = exports.extractIdsFromCommentHtml = exports.normalizeObjectIdCandidate = void 0;
const DEFAULT_PLACEHOLDER = (_fileId, url) => ({
    url,
    name: '',
    type: 'application/octet-stream',
    size: 0,
});
const htmlEntityDecode = (value) => value
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&');
const OBJECT_ID_LENGTH = 24;
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const normalizeObjectIdCandidate = (candidate) => {
    const trimmed = candidate.trim();
    if (trimmed.length !== OBJECT_ID_LENGTH) {
        return null;
    }
    if (!OBJECT_ID_PATTERN.test(trimmed)) {
        return null;
    }
    return trimmed.toLowerCase();
};
exports.normalizeObjectIdCandidate = normalizeObjectIdCandidate;
const collectObjectIds = (source) => {
    const result = new Set();
    const hexPattern = /[0-9a-fA-F]{24}/g;
    let match;
    while ((match = hexPattern.exec(source)) !== null) {
        const normalized = (0, exports.normalizeObjectIdCandidate)(match[0]);
        if (normalized) {
            result.add(normalized);
        }
    }
    return result;
};
const collectIdsFromAttribute = (value) => {
    const decoded = htmlEntityDecode(value);
    const tokens = decoded
        .split(/[ ,;\s]+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 0);
    const result = new Set();
    tokens.forEach((token) => {
        const normalized = (0, exports.normalizeObjectIdCandidate)(token);
        if (normalized) {
            result.add(normalized);
        }
    });
    return result;
};
const extractIdsFromCommentHtml = (html) => {
    var _a, _b;
    const source = typeof html === 'string' ? html : '';
    if (!source.trim()) {
        return [];
    }
    const decoded = htmlEntityDecode(source);
    const ids = new Set();
    const urlPattern = /\/api\/v1\/files\/([0-9a-fA-F]{24})/g;
    let match;
    while ((match = urlPattern.exec(decoded)) !== null) {
        const normalized = (0, exports.normalizeObjectIdCandidate)((_a = match[1]) !== null && _a !== void 0 ? _a : '');
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
exports.extractIdsFromCommentHtml = extractIdsFromCommentHtml;
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
    const normalized = (0, exports.normalizeObjectIdCandidate)(last);
    return normalized !== null && normalized !== void 0 ? normalized : null;
};
exports.extractFileIdFromUrl = extractFileIdFromUrl;
const buildAttachmentsFromCommentHtml = (commentHtml, options = {}) => {
    var _a;
    const existing = Array.isArray(options.existing)
        ? options.existing
            .filter((candidate) => Boolean(candidate && typeof candidate.url === 'string'))
            .map((candidate) => ({ ...candidate }))
        : [];
    const placeholderFactory = (_a = options.createPlaceholder) !== null && _a !== void 0 ? _a : (DEFAULT_PLACEHOLDER);
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
    const ids = (0, exports.extractIdsFromCommentHtml)(source);
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
        existing.push(placeholderFactory(id, url));
    });
    return existing;
};
exports.buildAttachmentsFromCommentHtml = buildAttachmentsFromCommentHtml;
