"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureTaskLinksShort = exports.normalizeManagedShortLink = void 0;
const shortLinks_1 = require("./shortLinks");
const LINK_FIELDS = [
    'start_location_link',
    'end_location_link',
    'google_route_url',
];
const normalizeManagedShortLink = (value) => {
    const slug = (0, shortLinks_1.extractSlug)(value);
    if (!slug)
        return value;
    return (0, shortLinks_1.buildShortLink)(slug);
};
exports.normalizeManagedShortLink = normalizeManagedShortLink;
const ensureTaskLinksShort = async (data = {}) => {
    await Promise.all(LINK_FIELDS.map(async (field) => {
        const raw = data[field];
        if (typeof raw !== 'string') {
            return;
        }
        const trimmed = raw.trim();
        if (!trimmed) {
            return;
        }
        if ((0, shortLinks_1.isShortLink)(trimmed)) {
            data[field] = (0, exports.normalizeManagedShortLink)(trimmed);
            return;
        }
        try {
            const { shortUrl } = await (0, shortLinks_1.ensureShortLink)(trimmed);
            data[field] = shortUrl;
        }
        catch (error) {
            console.error('Не удалось сократить ссылку задачи', { field, error });
        }
    }));
};
exports.ensureTaskLinksShort = ensureTaskLinksShort;
