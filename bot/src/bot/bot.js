// Основной файл бота Telegram. Используется dotenv и telegraf
require('dotenv').config()
if (process.env.NODE_ENV !== 'production') {
  console.log('BOT_TOKEN загружен')
}
const { botToken, chatId } = require('../config')

process.on('unhandledRejection', err => {
  console.error('Unhandled rejection in bot:', err)
})
process.on('uncaughtException', err => {
  console.error('Uncaught exception in bot:', err)
  process.exit(1)
})
const { Telegraf, Markup } = require('telegraf')
const messages = require('../messages')
const { createUser, getUser } = require('../services/service')
const { startScheduler } = require('../services/scheduler')
const bot = new Telegraf(botToken)
require('../db/model')

async function showMainMenu(ctx) {
  await ctx.reply(
    messages.menuPrompt,
    Markup.keyboard([["Регистрация"]]).resize()
  )
}

async function checkAndRegister(ctx) {
  try {
    const member = await bot.telegram.getChatMember(chatId, ctx.from.id)
    if (!['creator', 'administrator', 'member'].includes(member.status)) {
      return ctx.reply(messages.accessOnlyGroup)
    }
  } catch {
    return ctx.reply(messages.accessError)
  }
  const user = await getUser(ctx.from.id)
  if (user) {
    await ctx.reply(messages.welcomeBack)
  } else {
    await createUser(ctx.from.id, ctx.from.username)
    await ctx.reply(messages.registrationSuccess)
  }
}

bot.start(async ctx => {
  await checkAndRegister(ctx)
  await showMainMenu(ctx)
})

bot.command('register', checkAndRegister)
bot.hears('Регистрация', checkAndRegister)

async function startBot (retry = 0) {
  try {
    await bot.telegram.deleteWebhook()
    await bot.launch({ dropPendingUpdates: true })
    console.log('Бот запущен')
  } catch (err) {
    if (err.response?.error_code === 409 && retry < 5) {
      console.error('Конфликт polling, повторная попытка запуска')
      await new Promise(res => setTimeout(res, 3000))
      return startBot(retry + 1)
    }
    console.error('Не удалось запустить бота:', err)
    process.exit(1)
  }
  console.log(`Окружение: ${process.env.NODE_ENV || 'development'}, Node ${process.version}`)
}
startBot().then(() => {
  if (process.env.NODE_ENV !== 'test') startScheduler()
})
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
