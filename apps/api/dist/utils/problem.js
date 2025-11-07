"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendProblem = sendProblem;
const crypto_1 = require("crypto");
function sendProblem(req, res, problem) {
    const traceId = req.traceId || (0, crypto_1.randomUUID)();
    const body = { ...problem, instance: traceId };
    res.status(problem.status);
    if (typeof res.type === 'function') {
        res.type('application/problem+json');
    }
    else if (typeof res.setHeader === 'function') {
        res.setHeader('Content-Type', 'application/problem+json');
    }
    res.json(body);
}
