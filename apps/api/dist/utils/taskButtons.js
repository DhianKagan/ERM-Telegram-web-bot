"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskAcceptConfirmKeyboard = taskAcceptConfirmKeyboard;
exports.taskDoneConfirmKeyboard = taskDoneConfirmKeyboard;
exports.taskCancelConfirmKeyboard = taskCancelConfirmKeyboard;
exports.default = taskStatusKeyboard;
exports.taskStatusInlineMarkup = taskStatusInlineMarkup;
// Назначение: формирование кнопок изменения статуса задачи для чата
// Модули: telegraf Markup
const telegraf_1 = require("telegraf");
const taskStatusIcons_1 = require("./taskStatusIcons");
const statusButtonLabels = {
    'В работе': {
        default: 'В работу',
        active: `${taskStatusIcons_1.TASK_STATUS_ICON_MAP['В работе']} В работе`,
    },
    Выполнена: {
        default: 'Выполнена',
        active: `${taskStatusIcons_1.TASK_STATUS_ICON_MAP['Выполнена']} Выполнена`,
    },
    Отменена: {
        default: 'Отменить',
        active: `${taskStatusIcons_1.TASK_STATUS_ICON_MAP['Отменена']} Отменена`,
    },
};
const resolveStatusLabel = (target, currentStatus) => currentStatus === target
    ? statusButtonLabels[target].active
    : statusButtonLabels[target].default;
const ensureReplyMarkup = (keyboard, rows) => {
    const enriched = keyboard;
    if (!enriched.reply_markup) {
        enriched.reply_markup = {
            inline_keyboard: rows,
        };
    }
    return enriched;
};
const buildStatusRows = (id, currentStatus, options = {}) => {
    const primaryRow = [
        telegraf_1.Markup.button.callback(resolveStatusLabel('В работе', currentStatus), `task_accept_prompt:${id}`),
        telegraf_1.Markup.button.callback(resolveStatusLabel('Выполнена', currentStatus), `task_done_prompt:${id}`),
    ];
    if (options.kind === 'request') {
        primaryRow.push(telegraf_1.Markup.button.callback(resolveStatusLabel('Отменена', currentStatus), `task_cancel_prompt:${id}`));
    }
    const rows = [primaryRow];
    const actionsRow = [
        telegraf_1.Markup.button.callback('История', `task_history:${id}`),
    ];
    if (options.kind !== 'request') {
        actionsRow.push(telegraf_1.Markup.button.callback('Запрос на отмену', `task_cancel_request_prompt:${id}`));
    }
    rows.push(actionsRow);
    return rows;
};
function taskAcceptConfirmKeyboard(id) {
    const rows = [[
            telegraf_1.Markup.button.callback('Подтвердить', `task_accept_confirm:${id}`),
            telegraf_1.Markup.button.callback('Отмена', `task_accept_cancel:${id}`),
        ]];
    return ensureReplyMarkup(telegraf_1.Markup.inlineKeyboard(rows), rows);
}
function taskDoneConfirmKeyboard(id) {
    const rows = [[
            telegraf_1.Markup.button.callback('Подтвердить', `task_done_confirm:${id}`),
            telegraf_1.Markup.button.callback('Отмена', `task_done_cancel:${id}`),
        ]];
    return ensureReplyMarkup(telegraf_1.Markup.inlineKeyboard(rows), rows);
}
function taskCancelConfirmKeyboard(id) {
    const rows = [[
            telegraf_1.Markup.button.callback('Подтвердить', `task_cancel_confirm:${id}`),
            telegraf_1.Markup.button.callback('Отмена', `task_cancel_cancel:${id}`),
        ]];
    return ensureReplyMarkup(telegraf_1.Markup.inlineKeyboard(rows), rows);
}
function taskStatusKeyboard(id, currentStatus, options = {}, extras = {}) {
    const rows = buildStatusRows(id, currentStatus, options);
    const extraRow = [];
    if (extras.albumLink) {
        extraRow.push(telegraf_1.Markup.button.url('Фотоальбом', extras.albumLink));
    }
    if (extras.showCommentButton !== false) {
        extraRow.push(telegraf_1.Markup.button.callback('Комментарий', `task_comment_prompt:${id}`));
    }
    if (extraRow.length) {
        rows.unshift(extraRow);
    }
    return ensureReplyMarkup(telegraf_1.Markup.inlineKeyboard(rows), rows);
}
function taskStatusInlineMarkup(id, currentStatus, options = {}, extras = {}) {
    const rows = buildStatusRows(id, currentStatus, options);
    const extraRow = [];
    if (extras.albumLink) {
        extraRow.push(telegraf_1.Markup.button.url('Фотоальбом', extras.albumLink));
    }
    if (extras.showCommentButton !== false) {
        extraRow.push(telegraf_1.Markup.button.callback('Комментарий', `task_comment_prompt:${id}`));
    }
    if (extraRow.length) {
        rows.unshift(extraRow);
    }
    return ensureReplyMarkup(telegraf_1.Markup.inlineKeyboard(rows), rows).reply_markup;
}
