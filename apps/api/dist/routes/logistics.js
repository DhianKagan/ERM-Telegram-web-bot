"use strict";
// Маршруты SSE для логистических событий.
// Основные модули: express, services/logisticsEvents, middleware/auth.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("../middleware/auth"));
const middleware_1 = require("../api/middleware");
const logisticsEvents_1 = require("../services/logisticsEvents");
const router = (0, express_1.Router)();
function writeEvent(res, data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}
router.get('/events', (0, auth_1.default)(), (0, middleware_1.asyncHandler)(async (req, res) => {
    var _a;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    (_a = res.flushHeaders) === null || _a === void 0 ? void 0 : _a.call(res);
    res.write('retry: 5000\n\n');
    writeEvent(res, (0, logisticsEvents_1.createInitEvent)());
    const unsubscribe = (0, logisticsEvents_1.subscribeLogisticsEvents)((event) => {
        try {
            writeEvent(res, event);
        }
        catch (error) {
            console.error('Не удалось отправить событие логистики', error);
        }
    });
    const heartbeat = setInterval(() => {
        try {
            writeEvent(res, (0, logisticsEvents_1.createHeartbeatEvent)());
        }
        catch (error) {
            console.error('Не удалось отправить heartbeat логистики', error);
        }
    }, 30000);
    req.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
    });
}));
exports.default = router;
