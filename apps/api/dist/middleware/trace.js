"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = trace;
const crypto_1 = require("crypto");
const trace_1 = require("../utils/trace");
function generateSpanId() {
    return (0, crypto_1.randomUUID)().replace(/-/g, '').slice(0, 16);
}
function trace(req, res, next) {
    const header = req.header('traceparent');
    let traceId = '';
    if (header) {
        const m = header.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/);
        if (m)
            traceId = m[1];
    }
    if (!traceId) {
        traceId = (0, crypto_1.randomUUID)().replace(/-/g, '');
    }
    const spanId = generateSpanId();
    const traceparent = `00-${traceId}-${spanId}-01`;
    (0, trace_1.runWithTrace)({ traceId, traceparent }, () => {
        req.traceId = traceId;
        res.setHeader('traceparent', traceparent);
        res.setHeader('x-trace-id', traceId);
        next();
    });
}
