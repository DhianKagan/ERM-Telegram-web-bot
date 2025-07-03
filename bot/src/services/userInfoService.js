// Сервис выдачи сведений о пользователе и его статусе в группе.
// Модули: telegraf, config
const { Telegraf } = require('telegraf')
const { botToken, chatId } = require('../config')
const bot = new Telegraf(botToken)

// Возвращает статус участника чата по его Telegram ID.
async function getMemberStatus(id) {
  const member = await bot.telegram.getChatMember(chatId, id)
  return member.status
}

// Извлекает Telegram ID из контекста сообщения.
function getTelegramId(ctx) {
  return ctx.from?.id
}

module.exports = { getMemberStatus, getTelegramId }
