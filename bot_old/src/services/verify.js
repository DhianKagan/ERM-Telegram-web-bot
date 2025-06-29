// Сервис верификации пользователей и чатов через Bot API
const { call } = require('./telegramApi')

async function verifyUser(userId, description) {
  return call('verifyUser', {
    user_id: userId,
    ...(description ? { custom_description: description } : {})
  })
}

async function verifyChat(chatId, description) {
  return call('verifyChat', {
    chat_id: chatId,
    ...(description ? { custom_description: description } : {})
  })
}

module.exports = { verifyUser, verifyChat }
