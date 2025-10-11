// Сервис выдачи сведений о пользователе и его статусе в группе
// Модули: telegraf, config
import { Telegraf, Context } from 'telegraf';
import { botToken, getChatId, chatId as staticChatId } from '../config';

const resolveChatId = (): string | undefined =>
  typeof getChatId === 'function' ? getChatId() : staticChatId;

const bot = new Telegraf(botToken!);

/** Возвращает статус участника чата по его Telegram ID. */
export async function getMemberStatus(id: number): Promise<string> {
  const chatId = resolveChatId();
  if (!chatId) {
    throw new Error('CHAT_ID не задан, невозможно получить статус участника');
  }
  const member = await bot.telegram.getChatMember(chatId, id);
  return member.status;
}

/** Извлекает Telegram ID из контекста сообщения. */
export function getTelegramId(ctx: Context): number | undefined {
  return ctx.from?.id;
}
