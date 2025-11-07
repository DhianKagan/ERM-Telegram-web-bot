"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDiskSpace = checkDiskSpace;
exports.startDiskMonitor = startDiskMonitor;
// Мониторинг свободного места на диске
// Модули: fs, prom-client, services/messageQueue, services/telegramApi, config
const fs_1 = __importDefault(require("fs"));
const prom_client_1 = require("prom-client");
const storage_1 = require("../config/storage");
const messageQueue_1 = require("./messageQueue");
const telegramApi_1 = require("./telegramApi");
const config_1 = require("../config");
const resolveChatId = () => typeof config_1.getChatId === 'function' ? (0, config_1.getChatId)() : config_1.chatId;
const metrics_1 = require("../metrics");
const diskFreeGauge = new prom_client_1.Gauge({
    name: 'disk_free_bytes',
    help: 'Свободное место на диске в байтах',
    registers: [metrics_1.register],
});
const THRESHOLD = Number(process.env.DISK_FREE_WARN || 1073741824);
let warned = false;
async function checkDiskSpace() {
    try {
        const st = await fs_1.default.promises.statfs(storage_1.uploadsDir);
        const free = st.bfree * st.bsize;
        diskFreeGauge.set(free);
        if (free < THRESHOLD && !warned) {
            warned = true;
            const groupChatId = resolveChatId();
            if (groupChatId) {
                await (0, messageQueue_1.enqueue)(() => (0, telegramApi_1.call)('sendMessage', {
                    chat_id: groupChatId,
                    text: `Свободное место на диске менее ${Math.round(free / 1024 / 1024)} МБ`,
                }));
            }
        }
        if (free >= THRESHOLD)
            warned = false;
    }
    catch (e) {
        console.error('diskSpace', e);
        const groupChatId = resolveChatId();
        if (groupChatId) {
            await (0, messageQueue_1.enqueue)(() => (0, telegramApi_1.call)('sendMessage', {
                chat_id: groupChatId,
                text: 'Не удалось проверить свободное место на диске',
            }));
        }
    }
}
function startDiskMonitor() {
    if (typeof process !== 'undefined' &&
        (process.env.NODE_ENV === 'test' ||
            process.env.JEST_WORKER_ID !== undefined)) {
        return;
    }
    checkDiskSpace();
    const interval = setInterval(checkDiskSpace, 60 * 60 * 1000);
    if (typeof interval.unref === 'function') {
        interval.unref();
    }
}
