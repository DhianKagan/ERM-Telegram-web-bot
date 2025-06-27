// Основной файл бота Telegram. Использует dotenv, telegraf, сервисы задач,
// загрузку файлов в R2 и JWT-аутентификацию.
const { botToken, appUrl, chatId } = require('../config')
const { Telegraf, Markup } = require('telegraf')
const messages = require('../messages')
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
      return ctx.reply(messages.accessOnlyGroup)
    }
  } catch {
    return ctx.reply(messages.accessError)
  }
  const user = await getUser(ctx.from.id)
  if (!user) {
    await createUser(ctx.from.id, ctx.from.username)
    ctx.reply(messages.registered)
  } else {
    ctx.reply(messages.welcomeBack)
  }
  const isAdmin = await verifyAdmin(ctx.from.id)
  const token = generateToken({ id: ctx.from.id, username: ctx.from.username, isAdmin })
  const url = `${appUrl}?token=${token}`
  ctx.reply(
    'Нажмите кнопку для доступа',
    Markup.inlineKeyboard([
      Markup.button.webApp(messages.miniAppLinkText, url)
    ])
  );
})

bot.command('create_task', async (ctx) => {
  if (!await verifyAdmin(ctx.from.id)) {
    ctx.reply(messages.unauthorizedCreateTask);
    return
  }
  const taskDescription = ctx.message.text.split(' ').slice(1).join(' ')
  if (!taskDescription) {
    ctx.reply(messages.taskNameRequired)
    return
  }
  await createTask(taskDescription)
  ctx.reply(messages.taskCreated)
})

bot.command('assign_task', async (ctx) => {
  if (!await verifyAdmin(ctx.from.id)) {
    ctx.reply(messages.unauthorizedAssignTask);
    return
  }
  const [userId, taskId] = ctx.message.text.split(' ').slice(1)
  if (!userId || !taskId) {
    ctx.reply(messages.assignParamsRequired)
    return
  }
  await assignTask(userId, taskId)
  ctx.reply(messages.taskAssigned)
})

bot.command('list_users', async (ctx) => {
  if (!await verifyAdmin(ctx.from.id)) return ctx.reply(messages.adminsOnly)
  const users = await listUsers()
  const msg = users.map(u => `${u.telegram_id} ${u.username}`).join('\n') || messages.noUsers
  ctx.reply(msg)
})

bot.command('add_user', async (ctx) => {
  if (!await verifyAdmin(ctx.from.id)) return ctx.reply(messages.adminsOnly)
  const [id, username] = ctx.message.text.split(' ').slice(1)
  if (!id || !username) return ctx.reply(messages.invalidAddUserFormat)
  await createUser(Number(id), username)
  ctx.reply(messages.userAdded)
})

bot.command('list_tasks', async (ctx) => {
  const tasks = await listUserTasks(ctx.from.id)
  if (!tasks.length) {
    return ctx.reply(messages.noTasks)
  }
  const taskList = tasks.map(t => `${t.id}: ${t.task_description} (${t.status})`).join('\n')
  ctx.reply(taskList)
})

bot.command('register', async (ctx) => {
  try {
    const member = await bot.telegram.getChatMember(chatId, ctx.from.id)
    if (!['creator', 'administrator', 'member'].includes(member.status)) {
      return ctx.reply(messages.accessOnlyGroup)
    }
  } catch {
    return ctx.reply(messages.accessError)
  }
  const user = await getUser(ctx.from.id)
  if (user) return ctx.reply(messages.alreadyRegistered)
  await createUser(ctx.from.id, ctx.from.username)
  ctx.reply(messages.registrationSuccess)
})

bot.command('update_task_status', async (ctx) => {
  const [taskId, status] = ctx.message.text.split(' ').slice(1)
  await updateTaskStatus(taskId, status)
  ctx.reply(messages.statusUpdated)
})

bot.command('list_all_tasks', async (ctx) => {
  if (!await verifyAdmin(ctx.from.id)) return ctx.reply(messages.adminsOnly)
  const tasks = await listAllTasks()
  const text = tasks.map(t => `${t.id}: ${t.task_description} (${t.status})`).join('\n')
  ctx.reply(text || messages.noTasks)
})

bot.command('upload_file', async (ctx) => {
  const [name, ...data] = ctx.message.text.split(' ').slice(1)
  if (!name || !data.length) {
    ctx.reply(messages.uploadParamsRequired)
    return
  }
  await uploadFile(Buffer.from(data.join(' ')), name)
  ctx.reply(messages.fileUploaded)
})

bot.command('send_photo', async (ctx) => {
  const url = ctx.message.text.split(' ')[1]
  if (!url) return ctx.reply(messages.linkRequired)
  await call('sendPhoto', { chat_id: ctx.chat.id, photo: url })
})

bot.command('edit_last', async (ctx) => {
  const [id, ...text] = ctx.message.text.split(' ').slice(1)
  if (!id) return ctx.reply(messages.messageIdRequired)
  if (!text.length) return ctx.reply(messages.editTextRequired)
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
  try {
    const member = await bot.telegram.getChatMember(chatId, ctx.from.id)
    if (!['creator', 'administrator', 'member'].includes(member.status)) {
      return ctx.reply(messages.accessOnlyGroup)
    }
  } catch {
    return ctx.reply(messages.accessError)
  }
  let user = await getUser(ctx.from.id)
  if (!user) {
    await createUser(ctx.from.id, ctx.from.username)
  }
  const isAdmin = await verifyAdmin(ctx.from.id)
  const token = generateToken({ id: ctx.from.id, username: ctx.from.username, isAdmin })
  const url = `${appUrl}?token=${token}`
  ctx.reply(
    'Нажмите кнопку для доступа',
    Markup.inlineKeyboard([
      Markup.button.webApp(messages.miniAppLinkText, url)
    ])
  );
})

bot.launch().then(() => console.log('Bot started'))
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
