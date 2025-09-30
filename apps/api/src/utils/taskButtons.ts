// Назначение: формирование кнопок изменения статуса задачи для чата
// Модули: telegraf Markup
import { Markup } from 'telegraf';

export function taskAcceptConfirmKeyboard(
  id: string,
): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    Markup.button.callback('Подтвердить', `task_accept_confirm:${id}`),
    Markup.button.callback('Отмена', `task_accept_cancel:${id}`),
  ]);
}

export default function taskStatusKeyboard(
  id: string,
): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    Markup.button.callback('В работу', `task_accept_prompt:${id}`),
    Markup.button.callback('Выполнена', `task_done:${id}`),
  ]);
}
