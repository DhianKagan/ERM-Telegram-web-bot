"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("../middleware/auth"));
const liveTracking_1 = require("../services/liveTracking");
const router = (0, express_1.Router)();
const HEARTBEAT_INTERVAL_MS = 25000;
function writeEvent(res, event) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
}
router.get('/stream', (0, auth_1.default)(), (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders ===
        'function') {
        res.flushHeaders();
    }
    const initEvent = {
        type: 'init',
        timestamp: new Date().toISOString(),
        alarms: [],
    };
    writeEvent(res, initEvent);
    const unsubscribe = (0, liveTracking_1.subscribeTrackingEvents)((event) => {
        try {
            writeEvent(res, event);
        }
        catch (error) {
            console.error('Не удалось отправить событие трекинга', error);
        }
    });
    const heartbeatTimer = setInterval(() => {
        const heartbeat = {
            type: 'heartbeat',
            timestamp: new Date().toISOString(),
        };
        try {
            writeEvent(res, heartbeat);
        }
        catch (error) {
            console.error('Не удалось отправить heartbeat трекинга', error);
        }
    }, HEARTBEAT_INTERVAL_MS);
    const close = () => {
        clearInterval(heartbeatTimer);
        unsubscribe();
        res.end();
    };
    req.on('close', close);
    req.on('error', close);
});
exports.default = router;
