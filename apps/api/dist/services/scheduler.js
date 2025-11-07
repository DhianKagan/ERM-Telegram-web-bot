"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduler = startScheduler;
exports.stopScheduler = stopScheduler;
// Планировщик напоминаний для задач
// Модули: node-cron, telegramApi, messageQueue, config
const node_cron_1 = require("node-cron");
const shared_1 = require("shared");
const config_1 = require("../config");
const storage_1 = require("../config/storage");
const model_1 = require("../db/model");
const dataStorage_1 = require("./dataStorage");
const messageQueue_1 = require("./messageQueue");
const messageLink_1 = __importDefault(require("../utils/messageLink"));
const telegramApi_1 = require("./telegramApi");
const resolveChatId = () => typeof config_1.getChatId === 'function' ? (0, config_1.getChatId)() : config_1.chatId;
let reminderTask;
let cleanupTask;
const REMINDER_INTERVAL_MS = 60 * 60 * 1000;
const deadlineFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: shared_1.PROJECT_TIMEZONE,
});
const plural = (value, forms) => {
    const abs = Math.abs(value) % 100;
    const mod10 = abs % 10;
    if (abs > 10 && abs < 20)
        return forms[2];
    if (mod10 > 1 && mod10 < 5)
        return forms[1];
    if (mod10 === 1)
        return forms[0];
    return forms[2];
};
const formatDuration = (ms) => {
    const totalMinutes = Math.max(0, Math.round(ms / 60000));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    parts.push(`${days} ${plural(days, ['день', 'дня', 'дней'])}`);
    parts.push(`${hours} ${plural(hours, ['час', 'часа', 'часов'])}`);
    parts.push(`${minutes} ${plural(minutes, ['минута', 'минуты', 'минут'])}`);
    return parts.join(' ');
};
function startScheduler() {
    const expr = process.env.SCHEDULE_CRON || '0 * * * *';
    reminderTask = (0, node_cron_1.schedule)(expr, async () => {
        const now = new Date();
        const tasks = await model_1.Task.find({
            remind_at: { $lte: now },
            status: { $ne: 'done' },
        }).lean();
        for (const t of tasks) {
            const ids = new Set();
            if (t.assigned_user_id)
                ids.add(t.assigned_user_id);
            if (Array.isArray(t.assignees))
                t.assignees.forEach((id) => ids.add(id));
            let notified = false;
            for (const id of ids) {
                const user = await model_1.User.findOne({ telegram_id: id }).lean();
                if (user && user.receive_reminders !== false) {
                    await (0, messageQueue_1.enqueue)(() => (0, telegramApi_1.call)('sendMessage', {
                        chat_id: user.telegram_id,
                        text: `Напоминание: ${t.title}`,
                    }));
                    notified = true;
                }
            }
            if (!notified) {
                const groupChatId = resolveChatId();
                if (groupChatId) {
                    await (0, messageQueue_1.enqueue)(() => (0, telegramApi_1.call)('sendMessage', {
                        chat_id: groupChatId,
                        text: `Напоминание: ${t.title}`,
                    }));
                }
            }
        }
        if (tasks.length) {
            await model_1.Task.updateMany({ _id: { $in: tasks.map((t) => t._id) } }, { $unset: { remind_at: '' } });
        }
        const reminderCutoff = new Date(now.getTime() - REMINDER_INTERVAL_MS);
        const deadlineTasks = await model_1.Task.find({
            due_date: { $exists: true, $ne: null },
            status: { $nin: ['Выполнена', 'Отменена'] },
            $and: [
                {
                    $or: [
                        { deadline_reminder_sent_at: { $exists: false } },
                        { deadline_reminder_sent_at: { $lte: reminderCutoff } },
                    ],
                },
                {
                    $or: [
                        { assignees: { $exists: true, $ne: [] } },
                        { assigned_user_id: { $exists: true } },
                    ],
                },
            ],
        }).lean();
        if (deadlineTasks.length) {
            const processedIds = [];
            const preferenceCache = new Map();
            for (const t of deadlineTasks) {
                const recipients = new Set();
                if (typeof t.assigned_user_id === 'number') {
                    recipients.add(t.assigned_user_id);
                }
                if (Array.isArray(t.assignees)) {
                    t.assignees.forEach((id) => recipients.add(id));
                }
                if (!recipients.size)
                    continue;
                const allowedRecipients = [];
                for (const userId of recipients) {
                    if (!preferenceCache.has(userId)) {
                        const user = await model_1.User.findOne({ telegram_id: userId }).lean();
                        preferenceCache.set(userId, !user || user.receive_reminders !== false);
                    }
                    if (preferenceCache.get(userId)) {
                        allowedRecipients.push(userId);
                    }
                }
                if (!allowedRecipients.length)
                    continue;
                const dueRaw = t.due_date ?? null;
                const dueDate = dueRaw ? new Date(dueRaw) : null;
                if (!dueDate || Number.isNaN(dueDate.getTime()))
                    continue;
                const identifier = (t.task_number && String(t.task_number)) ||
                    (t.request_id && String(t.request_id)) ||
                    (typeof t._id === 'object' && t._id !== null && 'toString' in t._id
                        ? t._id.toString()
                        : String(t._id));
                const diffMs = dueDate.getTime() - now.getTime();
                const durationText = formatDuration(Math.abs(diffMs));
                const formattedDue = deadlineFormatter.format(dueDate).replace(', ', ' ');
                const groupChatId = resolveChatId();
                const link = (0, messageLink_1.default)(groupChatId, t.telegram_message_id, t.telegram_topic_id);
                if (!link)
                    continue;
                const prefix = `Дедлайн задачи <a href="${link}">${identifier}</a>`;
                const base = `${prefix} — срок ${formattedDue} (${shared_1.PROJECT_TIMEZONE_LABEL}), `;
                const messageText = diffMs <= 0
                    ? `${base}просрочен на ${durationText}.`
                    : `${base}время дедлайна через ${durationText}.`;
                await Promise.allSettled(allowedRecipients.map((userId) => (0, messageQueue_1.enqueue)(() => (0, telegramApi_1.call)('sendMessage', {
                    chat_id: userId,
                    text: messageText,
                    parse_mode: link ? 'HTML' : undefined,
                    link_preview_options: { is_disabled: true },
                })).catch((error) => {
                    console.error(`Не удалось отправить напоминание пользователю ${userId}`, error);
                })));
                const id = typeof t._id === 'object' && t._id !== null && 'toString' in t._id
                    ? t._id.toString()
                    : String(t._id);
                processedIds.push(id);
            }
            if (processedIds.length) {
                await model_1.Task.updateMany({ _id: { $in: processedIds } }, { $set: { deadline_reminder_sent_at: now } });
            }
        }
    });
    if (storage_1.storageCleanupRetentionDays > 0) {
        const retentionMs = storage_1.storageCleanupRetentionDays * 24 * 60 * 60 * 1000;
        cleanupTask = (0, node_cron_1.schedule)(storage_1.storageCleanupCron, async () => {
            const cutoff = new Date(Date.now() - retentionMs);
            const removed = await (0, dataStorage_1.removeDetachedFilesOlderThan)(cutoff);
            if (removed > 0) {
                console.info('Очистка хранилища завершена, удалено файлов:', removed);
            }
        });
    }
}
function stopScheduler() {
    if (reminderTask) {
        reminderTask.stop();
        reminderTask = undefined;
    }
    if (cleanupTask) {
        cleanupTask.stop();
        cleanupTask = undefined;
    }
}
