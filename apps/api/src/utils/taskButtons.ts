// Назначение: формирование кнопок изменения статуса задачи для чата
// Модули: telegraf Markup
import { Markup } from 'telegraf';
import type {
  InlineKeyboardButton,
  InlineKeyboardMarkup,
} from 'telegraf/typings/core/types/typegram';

type TaskStatus = 'Новая' | 'В работе' | 'Выполнена' | 'Отменена';

export interface TaskStatusKeyboardOptions {
  kind?: 'task' | 'request';
}

const statusButtonLabels: Record<
  Exclude<TaskStatus, 'Новая'>,
  { default: string; active: string }
> = {
  'В работе': { default: 'В работу', active: '🟢 В работе' },
  Выполнена: { default: 'Выполнена', active: '✅ Выполнена' },
  Отменена: { default: 'Отменить', active: '⛔️ Отменена' },
};

const resolveStatusLabel = (
  target: Exclude<TaskStatus, 'Новая'>,
  currentStatus?: TaskStatus,
): string =>
  currentStatus === target
    ? statusButtonLabels[target].active
    : statusButtonLabels[target].default;

type InlineKeyboardMatrix = InlineKeyboardButton[][];

const ensureReplyMarkup = <T extends ReturnType<typeof Markup.inlineKeyboard>>(
  keyboard: T,
  rows: InlineKeyboardMatrix,
): T & { reply_markup: InlineKeyboardMarkup } => {
  const enriched = keyboard as T & { reply_markup?: InlineKeyboardMarkup };
  if (!enriched.reply_markup) {
    enriched.reply_markup = {
      inline_keyboard: rows,
    } as InlineKeyboardMarkup;
  }
  return enriched as T & { reply_markup: InlineKeyboardMarkup };
};

const buildStatusRows = (
  id: string,
  currentStatus?: TaskStatus,
  options: TaskStatusKeyboardOptions = {},
): InlineKeyboardMatrix => {
  const primaryRow: InlineKeyboardButton[] = [
    Markup.button.callback(
      resolveStatusLabel('В работе', currentStatus),
      `task_accept_prompt:${id}`,
    ),
    Markup.button.callback(
      resolveStatusLabel('Выполнена', currentStatus),
      `task_done_prompt:${id}`,
    ),
  ];
  if (options.kind === 'request') {
    primaryRow.push(
      Markup.button.callback(
        resolveStatusLabel('Отменена', currentStatus),
        `task_cancel_prompt:${id}`,
      ),
    );
  }
  const rows: InlineKeyboardMatrix = [primaryRow];
  const actionsRow: InlineKeyboardButton[] = [
    Markup.button.callback('История', `task_history:${id}`),
  ];
  if (options.kind !== 'request') {
    actionsRow.push(
      Markup.button.callback('Запрос на отмену', `task_cancel_request_prompt:${id}`),
    );
  }
  rows.push(actionsRow);
  return rows;
};

export function taskAcceptConfirmKeyboard(
  id: string,
): ReturnType<typeof Markup.inlineKeyboard> {
  const rows: InlineKeyboardMatrix = [[
    Markup.button.callback('Подтвердить', `task_accept_confirm:${id}`),
    Markup.button.callback('Отмена', `task_accept_cancel:${id}`),
  ]];
  return ensureReplyMarkup(Markup.inlineKeyboard(rows), rows);
}

export function taskDoneConfirmKeyboard(
  id: string,
): ReturnType<typeof Markup.inlineKeyboard> {
  const rows: InlineKeyboardMatrix = [[
    Markup.button.callback('Подтвердить', `task_done_confirm:${id}`),
    Markup.button.callback('Отмена', `task_done_cancel:${id}`),
  ]];
  return ensureReplyMarkup(Markup.inlineKeyboard(rows), rows);
}

export function taskCancelConfirmKeyboard(
  id: string,
): ReturnType<typeof Markup.inlineKeyboard> {
  const rows: InlineKeyboardMatrix = [[
    Markup.button.callback('Подтвердить', `task_cancel_confirm:${id}`),
    Markup.button.callback('Отмена', `task_cancel_cancel:${id}`),
  ]];
  return ensureReplyMarkup(Markup.inlineKeyboard(rows), rows);
}

export default function taskStatusKeyboard(
  id: string,
  currentStatus?: TaskStatus,
  options: TaskStatusKeyboardOptions = {},
): ReturnType<typeof Markup.inlineKeyboard> {
  const rows = buildStatusRows(id, currentStatus, options);
  return ensureReplyMarkup(Markup.inlineKeyboard(rows), rows);
}

export function taskStatusInlineMarkup(
  id: string,
  currentStatus?: TaskStatus,
  options: TaskStatusKeyboardOptions = {},
): InlineKeyboardMarkup {
  const rows = buildStatusRows(id, currentStatus, options);
  return ensureReplyMarkup(Markup.inlineKeyboard(rows), rows).reply_markup;
}
