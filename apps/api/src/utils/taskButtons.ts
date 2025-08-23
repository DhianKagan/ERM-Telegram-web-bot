// Назначение: формирование кнопок изменения статуса задачи для чата
// Модули: telegraf Markup
import { Markup } from 'telegraf';

export default function taskStatusKeyboard(
  id: string,
): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    Markup.button.callback('В работу', `task_accept:${id}`),
    Markup.button.callback('Выполнена', `task_done:${id}`),
  ]);
}
