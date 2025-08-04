// Сервис выдачи сведений о пользователе и его статусе в группе
// Модули: telegraf, config
import { Telegraf, Context } from 'telegraf';
import { botToken, chatId } from '../config';

const bot = new Telegraf(botToken!);

/** Возвращает статус участника чата по его Telegram ID. */
export async function getMemberStatus(id: number): Promise<string> {
  const member = await bot.telegram.getChatMember(chatId!, id);
  return member.status;
}

/** Извлекает Telegram ID из контекста сообщения. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTelegramId(ctx: Context): number | undefined {
  return ctx.from?.id;
}

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(module as any).exports = { getMemberStatus, getTelegramId };
