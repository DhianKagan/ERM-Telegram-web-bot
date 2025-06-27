// Основной файл бота Telegram. Использует dotenv, telegraf, сервисы задач,
// загрузку файлов в R2 и JWT-аутентификацию.
/* global fetch */
const { botToken, appUrl, chatId, r2 } = require('../config')
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
  listAllTasks,
  getTask,
  updateUser,
  searchTasks,
  addAttachment,
  deleteTask
} = require('../services/service')
const { uploadFile } = require('../services/r2')
const { call } = require('../services/telegramApi')
const { verifyAdmin, generateToken } = require('../auth/auth')
const startScheduler = require('../services/scheduler')
const bot = new Telegraf(botToken)
require('../db/model')

// Функция отправки кнопки Web App с резервом на случай ошибки типа BUTTON_TYPE_INVALID
async function sendAccessButton(ctx, url) {
  try {
    await ctx.reply(
      'Нажмите кнопку для доступа',
      Markup.inlineKeyboard([
        Markup.button.webApp(messages.miniAppLinkText, url)
      ])
    )
  } catch (err) {
    if (err.description && err.description.includes('BUTTON_TYPE_INVALID')) {
      await ctx.reply(
        'Нажмите кнопку для доступа',
        Markup.inlineKeyboard([
          Markup.button.url(messages.miniAppLinkText, url)
        ])
      )
    } else {
      throw err
    }
  }
}

// Показывает меню действий с использованием inline-клавиатуры
async function showTaskMenu(ctx) {
  const isAdmin = await verifyAdmin(ctx.from.id)
  const rows = []
  if (isAdmin) {
    rows.push([Markup.button.callback('Все задачи', 'all_tasks')])
  }
  rows.push([Markup.button.callback('Мои задачи', 'my_tasks')])
  rows.push([Markup.button.callback(messages.miniAppLinkText, 'open_app')])
  await ctx.reply(messages.menuPrompt, Markup.inlineKeyboard(rows))
}

bot.start(async (ctx) => {
  const payload = ctx.startPayload
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
  if (payload && payload.startsWith('invite_')) {
    const id = payload.slice(7)
    await updateUser(ctx.from.id, { departmentId: id })
    await ctx.reply(`Вы присоединились к отделу ${id}`)
  }
  const isAdmin = await verifyAdmin(ctx.from.id)
  const token = generateToken({ id: ctx.from.id, username: ctx.from.username, isAdmin })
  let url = `${appUrl}?token=${token}`
  if (payload && payload.startsWith('task_')) {
    const taskId = payload.slice(5)
    const task = await getTask(taskId)
    if (task) {
      await ctx.reply(`${task.title} (${task.status})`)
      url += `&task=${taskId}`
    } else {
      await ctx.reply('Задача не найдена')
    }
  }
  await sendAccessButton(ctx, url)
})

bot.command('help', (ctx) => {
  ctx.reply(messages.help)
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
  for (const t of tasks) {
    await ctx.reply(
      `${t.id}: ${t.task_description} (${t.status})`,
      Markup.inlineKeyboard([
        Markup.button.callback('✔️', `done_${t.id}`),
        Markup.button.callback('❌', `del_${t.id}`)
      ])
    )
  }
})

bot.command('task_menu', async (ctx) => {
  await showTaskMenu(ctx)
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
  if (!tasks.length) {
    return ctx.reply(messages.noTasks)
  }
  for (const t of tasks) {
    await ctx.reply(
      `${t.id}: ${t.task_description} (${t.status})`,
      Markup.inlineKeyboard([
        Markup.button.callback('✔️', `done_${t.id}`),
        Markup.button.callback('❌', `del_${t.id}`)
      ])
    )
  }
})

bot.command('upload_file', async (ctx) => {
  const text = ctx.message.caption || ctx.message.text
  const [, taskId] = text.split(' ')
  if (!taskId) return ctx.reply(messages.uploadParamsRequired)
  const file = ctx.message.document || (ctx.message.photo && ctx.message.photo.pop())
  if (!file) return ctx.reply(messages.fileRequired)
  const { file_path } = await call('getFile', { file_id: file.file_id })
  const res = await fetch(`https://api.telegram.org/file/bot${botToken}/${file_path}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const key = `${taskId}/${file.file_unique_id}_${file.file_name || 'photo.jpg'}`
  await uploadFile(buffer, key)
  const url = `${r2.endpoint}/${r2.bucket}/${key}`
  await addAttachment(taskId, { name: file.file_name || 'photo.jpg', url })
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
  const parts = ctx.inlineQuery.query.trim().split(/\s+/)
  const cmd = parts.shift()
  const arg = parts.join(' ')
  if (cmd === 'add') {
    if (!arg) return ctx.answerInlineQuery([], { cache_time: 0 })
    const task = await createTask(arg, undefined, 'В течении дня', undefined, ctx.from.id)
    return ctx.answerInlineQuery([
      {
        type: 'article',
        id: String(task._id),
        title: 'Задача создана',
        input_message_content: { message_text: `Создана задача: ${task.title}` }
      }
    ], { cache_time: 0 })
  }
  if (cmd === 'search') {
    if (!arg) return ctx.answerInlineQuery([], { cache_time: 0 })
    const tasks = await searchTasks(arg)
    const results = tasks.map(t => ({
      type: 'article',
      id: String(t._id),
      title: t.title,
      input_message_content: { message_text: `${t.title} (${t.status})` }
    }))
    return ctx.answerInlineQuery(results, { cache_time: 0 })
  }
  await ctx.answerInlineQuery([
    {
      type: 'article',
      id: '1',
      title: 'Эхо',
      input_message_content: { message_text: ctx.inlineQuery.query }
    }
  ], { cache_time: 0 })
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
  await sendAccessButton(ctx, url)
})

// Команда /browser отправляет прямую ссылку на приложение для открытия во внешнем браузере
bot.command('browser', async (ctx) => {
  let user = await getUser(ctx.from.id)
  if (!user) {
    await createUser(ctx.from.id, ctx.from.username)
  }
  const isAdmin = await verifyAdmin(ctx.from.id)
  const token = generateToken({ id: ctx.from.id, username: ctx.from.username, isAdmin })
  const url = `${appUrl}?token=${token}`
  await ctx.reply(url)
})

bot.action('my_tasks', async (ctx) => {
  const tasks = await listUserTasks(ctx.from.id)
  if (!tasks.length) {
    await ctx.reply(messages.noTasks)
  } else {
    for (const t of tasks) {
      await ctx.reply(
        `${t.id}: ${t.task_description} (${t.status})`,
        Markup.inlineKeyboard([
          Markup.button.callback('✔️', `done_${t.id}`),
          Markup.button.callback('❌', `del_${t.id}`)
        ])
      )
    }
  }
  await ctx.answerCbQuery()
})

bot.action('all_tasks', async (ctx) => {
  if (!await verifyAdmin(ctx.from.id)) {
    await ctx.answerCbQuery(messages.adminsOnly, { show_alert: true })
    return
  }
  const tasks = await listAllTasks()
  if (!tasks.length) {
    await ctx.reply(messages.noTasks)
  } else {
    for (const t of tasks) {
      await ctx.reply(
        `${t.id}: ${t.task_description} (${t.status})`,
        Markup.inlineKeyboard([
          Markup.button.callback('✔️', `done_${t.id}`),
          Markup.button.callback('❌', `del_${t.id}`)
        ])
      )
    }
  }
  await ctx.answerCbQuery()
})

bot.action(/^done_(.+)$/, async (ctx) => {
  const id = ctx.match[1]
  await updateTaskStatus(id, 'done')
  await ctx.answerCbQuery(messages.taskCompleted, { show_alert: false })
  await ctx.editMessageText(`${ctx.update.callback_query.message.text} \n${messages.taskCompleted}`)
})

bot.action(/^del_(.+)$/, async (ctx) => {
  const id = ctx.match[1]
  await deleteTask(id)
  await ctx.answerCbQuery(messages.taskDeleted, { show_alert: false })
  await ctx.editMessageText(messages.taskDeleted)
})

bot.action('open_app', async (ctx) => {
  let user = await getUser(ctx.from.id)
  if (!user) {
    await createUser(ctx.from.id, ctx.from.username)
  }
  const isAdmin = await verifyAdmin(ctx.from.id)
  const token = generateToken({ id: ctx.from.id, username: ctx.from.username, isAdmin })
  const url = `${appUrl}?token=${token}`
  await sendAccessButton(ctx, url)
  await ctx.answerCbQuery()
})

bot.launch().then(() => console.log('Bot started'))
startScheduler()
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
