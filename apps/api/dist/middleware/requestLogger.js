"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = requestLogger;
const crypto_1 = require("crypto");
const wgLogEngine_1 = require("../services/wgLogEngine");
/**
 * Request logger middleware.
 * - Generates a requestId (uses X-Request-Id header if present)
 * - Logs incoming request with sanitized headers
 * - Logs finish event with status and duration
 * - Logs aborted requests
 *
 * This implementation uses Node's built-in crypto.randomUUID() to avoid
 * adding the 'uuid' package as a dependency.
 */
function sanitizeHeaders(h) {
    if (!h)
        return {};
    const out = {};
    for (const key of Object.keys(h)) {
        const low = key.toLowerCase();
        if (low === 'authorization') {
            out[key] = '<REDACTED>';
        }
        else {
            try {
                out[key] = h[key];
            }
            catch {
                out[key] = '<UNSERIALIZABLE>';
            }
        }
    }
    return out;
}
function requestLogger(req, res, next) {
    const headerReqId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined;
    const requestId = headerReqId || (0, crypto_1.randomUUID)();
    // attach requestId for downstream usage
    req.requestId = requestId;
    const start = Date.now();
    // log incoming request
    try {
        wgLogEngine_1.logger.info({ reqId: requestId, method: req.method, url: req.originalUrl, headers: sanitizeHeaders(req.headers) }, 'Incoming HTTP request');
    }
    catch (err) {
        // avoid breaking request on logging error
        // eslint-disable-next-line no-console
        console.error('Failed to log incoming request', err);
    }
    // when response finishes, log status and duration
    res.on('finish', () => {
        const duration = Date.now() - start;
        try {
            wgLogEngine_1.logger.info({ reqId: requestId, method: req.method, url: req.originalUrl, status: res.statusCode, durationMs: duration }, 'Request finished');
        }
        catch (err) {
            // eslint-disable-next-line no-console
            console.error('Failed to log finished request', err);
        }
    });
    // if request aborted by client (connection closed), log warn
    req.on('aborted', () => {
        const duration = Date.now() - start;
        try {
            wgLogEngine_1.logger.warn({ reqId: requestId, method: req.method, url: req.originalUrl, durationMs: duration }, 'Request aborted by client');
        }
        catch (err) {
            // eslint-disable-next-line no-console
            console.error('Failed to log aborted request', err);
        }
    });
    next();
}
