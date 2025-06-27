// Планировщик напоминаний для задач.
// Использует node-cron и Telegram Bot API.
const cron = require('node-cron')
const { Task } = require('../db/model')
const { call } = require('./telegramApi')
const { chatId } = require('../config')

function start() {
  const expr = process.env.SCHEDULE_CRON || '*/1 * * * *'
  cron.schedule(expr, async () => {
    const tasks = await Task.find({ remind_at: { $lte: new Date() }, status: { $ne: 'done' } })
    for (const t of tasks) {
      await call('sendMessage', { chat_id: chatId, text: `Напоминание: ${t.title}` })
      t.remind_at = undefined
      await t.save()
    }
  })
}

module.exports = start
