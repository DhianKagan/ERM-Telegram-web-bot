"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = metrics;
const metrics_1 = require("../metrics");
function metrics(req, res, next) {
    const end = metrics_1.httpRequestDuration.startTimer();
    res.on('finish', () => {
        const labels = {
            method: req.method,
            route: req.route ? req.route.path : req.path,
            status: res.statusCode,
        };
        metrics_1.httpRequestsTotal.inc(labels);
        end(labels);
    });
    next();
}
