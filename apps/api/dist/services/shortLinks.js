"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveShortLinkBySlug = exports.ensureShortLink = exports.resolveShortLink = exports.isShortLink = exports.extractSlug = exports.buildShortLink = exports.getShortLinkBase = exports.getShortLinkPathPrefix = void 0;
// Сервис коротких ссылок приложения
// Модули: crypto, mongoose модели, config
const node_crypto_1 = require("node:crypto");
const model_1 = require("../db/model");
const config_1 = require("../config");
const SHORT_PATH_SEGMENT = 'l';
const SHORT_PATH_PREFIX = (() => {
    try {
        const base = new URL(config_1.appUrl);
        const normalizedPath = base.pathname.replace(/\/+$/, '');
        return `${normalizedPath}/${SHORT_PATH_SEGMENT}/`.replace(/\/+/g, '/');
    }
    catch {
        return '/l/';
    }
})();
const getShortLinkPathPrefix = () => {
    if (SHORT_PATH_PREFIX.startsWith('/')) {
        const trimmed = SHORT_PATH_PREFIX.replace(/\/+$/, '');
        return trimmed || '/l';
    }
    const normalized = SHORT_PATH_PREFIX.replace(/\/+$/, '') || SHORT_PATH_SEGMENT;
    return `/${normalized}`;
};
exports.getShortLinkPathPrefix = getShortLinkPathPrefix;
const APP_ORIGIN = (() => {
    try {
        const parsed = new URL(config_1.appUrl);
        parsed.pathname = '/';
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString();
    }
    catch {
        return null;
    }
})();
const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const isStorageReady = () => {
    var _a;
    try {
        return ((_a = model_1.ShortLink.db) === null || _a === void 0 ? void 0 : _a.readyState) === 1;
    }
    catch {
        return false;
    }
};
const generateSlug = (length = 8) => {
    const alphabetLen = SLUG_ALPHABET.length;
    const maxUnbiasedValue = Math.floor(256 / alphabetLen) * alphabetLen;
    let slug = '';
    while (slug.length < length) {
        const byte = (0, node_crypto_1.randomBytes)(1)[0];
        if (byte >= maxUnbiasedValue) {
            continue;
        }
        const value = byte % alphabetLen;
        slug += SLUG_ALPHABET[value];
    }
    return slug;
};
const getShortLinkBase = () => {
    if (!APP_ORIGIN)
        return null;
    try {
        const base = new URL(APP_ORIGIN);
        base.pathname = SHORT_PATH_PREFIX;
        return base.toString();
    }
    catch {
        return null;
    }
};
exports.getShortLinkBase = getShortLinkBase;
const buildShortLink = (slug) => {
    var _a;
    const base = (0, exports.getShortLinkBase)();
    if (!base) {
        return slug;
    }
    const target = new URL(base);
    const normalizedSlug = ((_a = normalizeSlug(slug)) !== null && _a !== void 0 ? _a : slug)
        .replace(/\/+$/g, '')
        .trim();
    target.pathname = `${SHORT_PATH_PREFIX}${normalizedSlug}`;
    target.search = '';
    target.hash = '';
    return target.toString();
};
exports.buildShortLink = buildShortLink;
const normalizeSlug = (value) => {
    if (!value)
        return null;
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    if (/[^0-9a-zA-Z_-]/.test(trimmed)) {
        return null;
    }
    return trimmed;
};
const extractSlug = (input) => {
    var _a;
    if (!input)
        return null;
    const trimmed = input.trim();
    if (!trimmed)
        return null;
    if (trimmed.startsWith('/')) {
        const normalized = trimmed.replace(/^\/+/, '');
        if (normalized.startsWith(`${SHORT_PATH_SEGMENT}/`)) {
            const [, slugCandidate] = normalized.split('/');
            return normalizeSlug(slugCandidate !== null && slugCandidate !== void 0 ? slugCandidate : '');
        }
        return null;
    }
    try {
        const parsed = new URL(trimmed, APP_ORIGIN !== null && APP_ORIGIN !== void 0 ? APP_ORIGIN : undefined);
        if (APP_ORIGIN && parsed.origin !== new URL(APP_ORIGIN).origin) {
            return null;
        }
        const prefix = SHORT_PATH_PREFIX.replace(/\/+$/, '');
        if (!parsed.pathname.startsWith(prefix)) {
            return null;
        }
        const slugCandidate = (_a = parsed.pathname.slice(prefix.length).split('/')[0]) !== null && _a !== void 0 ? _a : '';
        return normalizeSlug(slugCandidate);
    }
    catch {
        return null;
    }
};
exports.extractSlug = extractSlug;
const isShortLink = (input) => (0, exports.extractSlug)(input) !== null;
exports.isShortLink = isShortLink;
const resolveByFilter = async (filter) => {
    try {
        return await model_1.ShortLink.findOneAndUpdate(filter, {
            $inc: { access_count: 1 },
            $set: { last_accessed_at: new Date() },
        }, { new: true }).exec();
    }
    catch (error) {
        console.error('Не удалось разрешить короткую ссылку', error);
        return null;
    }
};
const resolveShortLink = async (input) => {
    var _a, _b;
    const slug = (_a = (0, exports.extractSlug)(input)) !== null && _a !== void 0 ? _a : normalizeSlug(input);
    if (!slug)
        return null;
    const doc = await resolveByFilter({ slug });
    return (_b = doc === null || doc === void 0 ? void 0 : doc.url) !== null && _b !== void 0 ? _b : null;
};
exports.resolveShortLink = resolveShortLink;
const resolveExistingByUrl = async (url) => {
    try {
        return await model_1.ShortLink.findOne({ url }).exec();
    }
    catch (error) {
        console.error('Не удалось найти короткую ссылку по URL', error);
        return null;
    }
};
const ensureShortLink = async (url) => {
    var _a;
    const normalized = url.trim();
    if (!normalized) {
        throw new Error('URL не должен быть пустым');
    }
    if (!isStorageReady()) {
        throw new Error('Хранилище коротких ссылок недоступно');
    }
    try {
        // Проверяем валидность URL
        const parsedUrl = new URL(normalized);
        parsedUrl.toString();
    }
    catch {
        throw new Error('Некорректный URL для сокращения');
    }
    const existing = await resolveExistingByUrl(normalized);
    if (existing) {
        return { slug: existing.slug, shortUrl: (0, exports.buildShortLink)(existing.slug) };
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const slug = generateSlug();
        try {
            const doc = await model_1.ShortLink.create({ slug, url: normalized });
            return { slug: doc.slug, shortUrl: (0, exports.buildShortLink)(doc.slug) };
        }
        catch (error) {
            const mongoError = error;
            if ((mongoError === null || mongoError === void 0 ? void 0 : mongoError.code) === 11000) {
                if ((_a = mongoError.keyPattern) === null || _a === void 0 ? void 0 : _a.url) {
                    const duplicate = await resolveExistingByUrl(normalized);
                    if (duplicate) {
                        return {
                            slug: duplicate.slug,
                            shortUrl: (0, exports.buildShortLink)(duplicate.slug),
                        };
                    }
                }
                continue;
            }
            console.error('Не удалось создать короткую ссылку', error);
            throw error;
        }
    }
    throw new Error('Не удалось создать уникальную короткую ссылку');
};
exports.ensureShortLink = ensureShortLink;
const resolveShortLinkBySlug = async (slug) => {
    var _a;
    const normalized = normalizeSlug(slug);
    if (!normalized)
        return null;
    const doc = await resolveByFilter({ slug: normalized });
    return (_a = doc === null || doc === void 0 ? void 0 : doc.url) !== null && _a !== void 0 ? _a : null;
};
exports.resolveShortLinkBySlug = resolveShortLinkBySlug;
