// Сервис верификации пользователей и чатов через Bot API.
// Разделяет прямые вызовы API и логику обработки ошибок.
const { call } = require('./telegramApi')

let verificationBlocked = false

function callVerifyUser(userId, description) {
  return call('verifyUser', {
    user_id: userId,
    ...(description ? { custom_description: description } : {})
  })
}

function callVerifyChat(chatId, description) {
  return call('verifyChat', {
    chat_id: chatId,
    ...(description ? { custom_description: description } : {})
  })
}

async function verifyUser(userId, description) {
  if (verificationBlocked) return
  try {
    await callVerifyUser(userId, description)
  } catch (e) {
    if (e.message && e.message.includes('BOT_VERIFIER_FORBIDDEN')) {
      console.error('Не хватает прав на верификацию пользователя. Проверьте BOT_TOKEN')
      verificationBlocked = true
      process.exit(1)
    }
    throw e
  }
}

async function verifyChat(chatId, description) {
  if (verificationBlocked) return
  try {
    await callVerifyChat(chatId, description)
  } catch (e) {
    if (e.message && e.message.includes('BOT_VERIFIER_FORBIDDEN')) {
      console.error('Не хватает прав на верификацию чата. Проверьте BOT_TOKEN')
      verificationBlocked = true
      process.exit(1)
    }
    throw e
  }
}

module.exports = { verifyUser, verifyChat, callVerifyUser, callVerifyChat }
