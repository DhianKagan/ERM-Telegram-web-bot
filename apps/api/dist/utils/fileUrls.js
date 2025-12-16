"use strict";
// Назначение файла: вспомогательные функции для формирования ссылок на файлы API.
// Основные модули: URLSearchParams
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildThumbnailUrl = exports.buildInlineFileUrl = exports.buildFileUrl = void 0;
const FILE_ROUTE_PREFIX = '/api/v1/files';
const buildFileUrl = (id, options = {}) => {
    const value = typeof id === 'string' ? id : String(id);
    const base = `${FILE_ROUTE_PREFIX}/${value}`;
    const params = new URLSearchParams();
    if (options.inline) {
        params.set('mode', 'inline');
    }
    if (options.thumbnail) {
        params.set('variant', 'thumbnail');
    }
    const query = params.toString();
    return query ? `${base}?${query}` : base;
};
exports.buildFileUrl = buildFileUrl;
const buildInlineFileUrl = (id) => (0, exports.buildFileUrl)(id, { inline: true });
exports.buildInlineFileUrl = buildInlineFileUrl;
const buildThumbnailUrl = (id) => (0, exports.buildFileUrl)(id, { inline: true, thumbnail: true });
exports.buildThumbnailUrl = buildThumbnailUrl;
