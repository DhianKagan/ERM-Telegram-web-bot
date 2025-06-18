// Основной файл бота Telegram
require('dotenv').config()
const { Telegraf } = require('telegraf')
const { createTask, assignTask, listUserTasks, updateTaskStatus } = require('../services/service')
const { uploadFile } = require('../services/r2')
const { verifyAdmin, generateToken } = require('../auth/auth')
const bot = new Telegraf(process.env.BOT_TOKEN)
require('../db/model')


bot.start((ctx) => ctx.reply('Welcome to the Task Manager Bot!'));

bot.command('create_task', async (ctx) => {
  if (!await verifyAdmin(ctx.from.id)) {
    ctx.reply('Unauthorized: Only admins can create tasks.');
    return
  }
  const taskDescription = ctx.message.text.split(' ').slice(1).join(' ')
  await createTask(taskDescription)
  ctx.reply('Task created successfully!')
})

bot.command('assign_task', async (ctx) => {
  if (!await verifyAdmin(ctx.from.id)) {
    ctx.reply('Unauthorized: Only admins can assign tasks.');
    return
  }
  const [userId, taskId] = ctx.message.text.split(' ').slice(1)
  await assignTask(userId, taskId)
  ctx.reply('Task assigned successfully!')
})

bot.command('list_tasks', async (ctx) => {
  const tasks = await listUserTasks(ctx.from.id)
  const taskList = tasks.map(t => `${t.id}: ${t.task_description} (${t.status})`).join('\n')
  ctx.reply(taskList)
})

bot.command('update_task_status', async (ctx) => {
  const [taskId, status] = ctx.message.text.split(' ').slice(1)
  await updateTaskStatus(taskId, status)
  ctx.reply('Task status updated successfully!')
})

bot.command('upload_file', async (ctx) => {
  const [name, ...data] = ctx.message.text.split(' ').slice(1)
  await uploadFile(Buffer.from(data.join(' ')), name)
  ctx.reply('Файл загружен в R2')
})
bot.launch()
console.log('Bot started')
