// Основной файл бота Telegram. Использует dotenv, telegraf, сервисы задач,
// загрузку файлов в R2 и JWT-аутентификацию.
const { botToken, appUrl, chatId } = require('../config')
const { Telegraf } = require('telegraf')
const {
  createTask,
  assignTask,
  listUserTasks,
  updateTaskStatus,
  createUser,
  listUsers,
  getUser,
  listAllTasks
} = require('../services/service')
const { uploadFile } = require('../services/r2')
const { call } = require('../services/telegramApi')
const { verifyAdmin, generateToken } = require('../auth/auth')
const bot = new Telegraf(botToken)
require('../db/model')


bot.start(async (ctx) => {
  try {
    const member = await bot.telegram.getChatMember(chatId, ctx.from.id)
    if (!['creator', 'administrator', 'member'].includes(member.status)) {
      return ctx.reply('Доступ разрешён только участникам группы')
    }
  } catch {
    return ctx.reply('Ошибка проверки доступа')
  }
  const user = await getUser(ctx.from.id)
  if (!user) {
    await createUser(ctx.from.id, ctx.from.username)
    ctx.reply('Вы зарегистрированы в системе.')
  } else {
    ctx.reply('С возвращением!')
  }
  const isAdmin = await verifyAdmin(ctx.from.id)
  const token = generateToken({ id: ctx.from.id, username: ctx.from.username, isAdmin })
  const url = `${appUrl}?token=${token}`
  ctx.replyWithHTML(`<a href="${url}">Открыть мини-приложение</a>`, { disable_web_page_preview: true })
})

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

bot.command('list_users', async (ctx) => {
  if (!await verifyAdmin(ctx.from.id)) return ctx.reply('Только для админов')
  const users = await listUsers()
  const msg = users.map(u => `${u.telegram_id} ${u.username}`).join('\n') || 'Нет пользователей'
  ctx.reply(msg)
})

bot.command('add_user', async (ctx) => {
  if (!await verifyAdmin(ctx.from.id)) return ctx.reply('Только для админов')
  const [id, username] = ctx.message.text.split(' ').slice(1)
  if (!id || !username) return ctx.reply('Формат: /add_user id username')
  await createUser(Number(id), username)
  ctx.reply('Пользователь добавлен')
})

bot.command('list_tasks', async (ctx) => {
  const tasks = await listUserTasks(ctx.from.id)
  const taskList = tasks.map(t => `${t.id}: ${t.task_description} (${t.status})`).join('\n')
  ctx.reply(taskList)
})

bot.command('register', async (ctx) => {
  try {
    const member = await bot.telegram.getChatMember(chatId, ctx.from.id)
    if (!['creator', 'administrator', 'member'].includes(member.status)) {
      return ctx.reply('Доступ разрешён только участникам группы')
    }
  } catch {
    return ctx.reply('Ошибка проверки доступа')
  }
  const user = await getUser(ctx.from.id)
  if (user) return ctx.reply('Вы уже зарегистрированы')
  await createUser(ctx.from.id, ctx.from.username)
  ctx.reply('Регистрация успешна')
})

bot.command('update_task_status', async (ctx) => {
  const [taskId, status] = ctx.message.text.split(' ').slice(1)
  await updateTaskStatus(taskId, status)
  ctx.reply('Task status updated successfully!')
})

bot.command('list_all_tasks', async (ctx) => {
  if (!await verifyAdmin(ctx.from.id)) return ctx.reply('Только для админов')
  const tasks = await listAllTasks()
  const text = tasks.map(t => `${t.id}: ${t.task_description} (${t.status})`).join('\n')
  ctx.reply(text || 'Нет задач')
})

bot.command('upload_file', async (ctx) => {
  const [name, ...data] = ctx.message.text.split(' ').slice(1)
  await uploadFile(Buffer.from(data.join(' ')), name)
  ctx.reply('Файл загружен в R2')
})

bot.command('send_photo', async (ctx) => {
  const url = ctx.message.text.split(' ')[1]
  if (!url) return ctx.reply('Укажите ссылку на фото')
  await call('sendPhoto', { chat_id: ctx.chat.id, photo: url })
})

bot.command('edit_last', async (ctx) => {
  const [id, ...text] = ctx.message.text.split(' ').slice(1)
  if (!id) return ctx.reply('Укажите id сообщения')
  await call('editMessageText', { chat_id: ctx.chat.id, message_id: Number(id), text: text.join(' ') })
})

bot.on('inline_query', async (ctx) => {
  const q = ctx.inlineQuery.query
  const results = [{
    type: 'article',
    id: '1',
    title: 'Эхо',
    input_message_content: { message_text: q }
  }]
  await ctx.answerInlineQuery(results, { cache_time: 0 })
})

bot.command('app', async (ctx) => {
  const isAdmin = await verifyAdmin(ctx.from.id)
  const token = generateToken({ id: ctx.from.id, username: ctx.from.username, isAdmin })
  const url = `${appUrl}?token=${token}`
  ctx.replyWithHTML(`<a href="${url}">Открыть мини-приложение</a>`, { disable_web_page_preview: true })
})

bot.launch().then(() => console.log('Bot started'))
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
