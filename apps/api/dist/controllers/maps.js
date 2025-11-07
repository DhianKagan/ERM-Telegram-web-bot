"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expand = expand;
exports.search = search;
exports.reverse = reverse;
const maps_1 = require("../services/maps");
const shared_1 = require("shared");
const problem_1 = require("../utils/problem");
const shortLinks_1 = require("../services/shortLinks");
const taskLinks_1 = require("../services/taskLinks");
async function expand(req, res) {
    try {
        const input = typeof req.body.url === 'string' ? req.body.url.trim() : '';
        if (!input) {
            throw new Error('empty');
        }
        const managedShortLink = (0, shortLinks_1.isShortLink)(input);
        let resolvedSource = input;
        if (managedShortLink) {
            const expanded = await (0, shortLinks_1.resolveShortLink)(input);
            if (!expanded) {
                throw new Error('not-found');
            }
            resolvedSource = expanded;
        }
        const full = await (0, maps_1.expandMapsUrl)(resolvedSource);
        let shortUrl;
        if (managedShortLink) {
            shortUrl = (0, taskLinks_1.normalizeManagedShortLink)(input);
        }
        else {
            try {
                const { shortUrl: ensured } = await (0, shortLinks_1.ensureShortLink)(full);
                shortUrl = ensured;
            }
            catch (error) {
                console.error('Не удалось создать короткую ссылку для карты', error);
            }
        }
        res.json({
            url: full,
            coords: (0, shared_1.extractCoords)(full),
            ...(shortUrl ? { short: shortUrl } : {}),
        });
    }
    catch {
        (0, problem_1.sendProblem)(req, res, {
            type: 'about:blank',
            title: 'Некорректная ссылка',
            status: 400,
            detail: 'invalid url',
        });
    }
}
async function search(req, res) {
    try {
        const query = typeof req.query.q === 'string' ? req.query.q : '';
        if (!query.trim()) {
            res.json({ items: [] });
            return;
        }
        const languageHeader = typeof req.headers['accept-language'] === 'string'
            ? req.headers['accept-language']
            : undefined;
        const items = await (0, maps_1.searchAddress)(query, {
            limit: typeof req.query.limit === 'string'
                ? Number.parseInt(req.query.limit, 10)
                : undefined,
            language: languageHeader,
        });
        res.json({ items });
    }
    catch (error) {
        console.error('Ошибка поиска адреса через Nominatim', error);
        res.json({ items: [] });
    }
}
async function reverse(req, res) {
    try {
        const latRaw = typeof req.query.lat === 'string' ? req.query.lat : '';
        const lngRaw = typeof req.query.lng === 'string'
            ? req.query.lng
            : typeof req.query.lon === 'string'
                ? req.query.lon
                : '';
        const lat = Number.parseFloat(latRaw);
        const lng = Number.parseFloat(lngRaw);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            res.json({ place: null });
            return;
        }
        const languageHeader = typeof req.headers['accept-language'] === 'string'
            ? req.headers['accept-language']
            : undefined;
        const place = await (0, maps_1.reverseGeocode)({ lat, lng }, { language: languageHeader });
        res.json({ place });
    }
    catch (error) {
        console.error('Ошибка реверс-геокодирования через Nominatim', error);
        res.json({ place: null });
    }
}
