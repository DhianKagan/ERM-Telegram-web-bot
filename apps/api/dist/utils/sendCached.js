"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCached = sendCached;
// Назначение файла: отправка JSON с ETag и заголовками кеширования
// Основные модули: crypto, express
const crypto_1 = require("crypto");
function sendCached(req, res, data) {
    const body = JSON.stringify(data);
    const etag = (0, crypto_1.createHash)('sha256').update(body).digest('hex');
    res.setHeader('Cache-Control', 'max-age=60, stale-while-revalidate=120');
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
        res.status(304).end();
        return;
    }
    res.json(data);
}
