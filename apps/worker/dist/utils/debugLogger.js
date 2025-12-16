"use strict";
// apps/worker/src/utils/debugLogger.ts
// Worker-side debug logger for outbound route calls.
// Uses the worker's local pino logger to avoid cross-package imports.
Object.defineProperty(exports, "__esModule", { value: true });
exports.logOutboundRouteCall = logOutboundRouteCall;
const logger_1 = require("../logger");
function logOutboundRouteCall(opts) {
    const duration = opts.start ? Date.now() - opts.start : undefined;
    const safeBody = typeof opts.resBody === 'string' && opts.resBody.length > 1000
        ? opts.resBody.slice(0, 1000) + '...[truncated]'
        : opts.resBody;
    logger_1.logger.info({
        reqId: opts.reqId,
        url: opts.url,
        durationMs: duration,
        reqHeaders: maskHeaders(opts.headers),
        resStatus: opts.resStatus,
        resBody: safeBody,
        err: opts.error
            ? opts.error instanceof Error
                ? { name: opts.error.name, message: opts.error.message }
                : opts.error
            : undefined,
    }, 'Worker outbound route call');
}
function maskHeaders(h) {
    if (!h)
        return h;
    const out = {};
    for (const k of Object.keys(h)) {
        if (k.toLowerCase() === 'authorization')
            out[k] = '<REDACTED>';
        else
            out[k] = h[k];
    }
    return out;
}
