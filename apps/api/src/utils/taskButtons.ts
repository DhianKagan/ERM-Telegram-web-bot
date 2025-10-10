// Назначение: формирование кнопок изменения статуса задачи для чата
// Модули: telegraf Markup
import { Markup } from 'telegraf';
import type { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';

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

export function taskAcceptConfirmKeyboard(
  id: string,
): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    Markup.button.callback('Подтвердить', `task_accept_confirm:${id}`),
    Markup.button.callback('Отмена', `task_accept_cancel:${id}`),
  ]);
}

export function taskDoneConfirmKeyboard(
  id: string,
): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    Markup.button.callback('Подтвердить', `task_done_confirm:${id}`),
    Markup.button.callback('Отмена', `task_done_cancel:${id}`),
  ]);
}

export function taskCancelConfirmKeyboard(
  id: string,
): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    Markup.button.callback('Подтвердить', `task_cancel_confirm:${id}`),
    Markup.button.callback('Отмена', `task_cancel_cancel:${id}`),
  ]);
}

export default function taskStatusKeyboard(
  id: string,
  currentStatus?: TaskStatus,
  options: TaskStatusKeyboardOptions = {},
): ReturnType<typeof Markup.inlineKeyboard> {
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
  const rows: InlineKeyboardButton[][] = [primaryRow];
  const actionsRow: InlineKeyboardButton[] = [
    Markup.button.callback('История', `task_history:${id}`),
  ];
  if (options.kind !== 'request') {
    actionsRow.push(
      Markup.button.callback('Запрос на отмену', `task_cancel_request_prompt:${id}`),
    );
  }
  rows.push(actionsRow);
  return Markup.inlineKeyboard(rows);
}
