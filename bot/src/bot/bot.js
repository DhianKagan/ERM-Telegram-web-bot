// Основной файл бота Telegram. Использует dotenv, telegraf, сервисы задач,
// загрузку файлов в R2 и JWT-аутентификацию.
require('dotenv').config()
if (process.env.NODE_ENV !== 'production') {
  console.log('BOT_TOKEN:', process.env.BOT_TOKEN)
}
const { botToken, botApiUrl, appUrl, chatId, r2 } = require('../config')

process.on('unhandledRejection', err => {
  console.error('Unhandled rejection in bot:', err)
})
process.on('uncaughtException', err => {
  console.error('Uncaught exception in bot:', err)
  process.exit(1)
})
const { Telegraf, Markup } = require('telegraf')
const path = require('path')
const messages = require('../messages')
const {
  createTask,
  assignTask,
  assignGroup,
  listUserTasks,
  updateTaskStatus,
  createUser,
  listUsers,
  getUser,
  listAllTasks,
  getTask,
  updateTask,
  updateUser,
  searchTasks,
  addAttachment,
  deleteTask
} = require('../services/service')
const { getMemberStatus, getTelegramId } = require('../services/userInfoService')
const { uploadFile } = require('../services/r2')
const { call } = require('../services/telegramApi')
const { sendCode } = require('../services/otp')
const { verifyAdmin, generateToken } = require('../auth/auth')
const { startScheduler } = require('../services/scheduler')
const bot = new Telegraf(botToken)
require('../db/model')

// Хранилище незавершённых команд /assign_task
const pendingAssignments = new Map()

// Функция отправки кнопки Web App с резервом на случай ошибки типа BUTTON_TYPE_INVALID
async function sendAccessButton(ctx, url) {
  const send = async chatId => {
    try {
      await bot.telegram.sendMessage(
        chatId,
        'Нажмите кнопку для доступа',
        Markup.inlineKeyboard([
          Markup.button.webApp(messages.miniAppLinkText, url)
        ])
      )
    } catch (err) {
      if (err.description && err.description.includes('BUTTON_TYPE_INVALID')) {
        await bot.telegram.sendMessage(
          chatId,
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
  if (ctx.chat.type === 'private') {
    await send(ctx.chat.id)
  } else {
    await ctx.reply(messages.privateToken)
    await send(ctx.from.id)
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

// Главное меню с кнопками команд
async function showMainMenu(ctx) {
  await ctx.reply(
    messages.menuPrompt,
    Markup.keyboard([
      ['/help', '/whoami', '/register'],
      ['/task_menu', '/app', '/browser']
    ]).resize()
  )
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
    await sendCode({ telegramId: ctx.from.id })
    ctx.reply(messages.codeSent)
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
  await showMainMenu(ctx)
})

bot.command('help', (ctx) => {
  ctx.reply(messages.help)
})

bot.command('whoami', async (ctx) => {
  const id = getTelegramId(ctx)
  let status
  try {
    status = await getMemberStatus(id)
  } catch {
    return ctx.reply(messages.accessError)
  }
  ctx.reply(`${messages.idLabel}: ${id}\n${messages.statusLabel}: ${status}`)
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
  const task = await createTask(taskDescription)
  try {
    const topic = await call('createForumTopic', { chat_id: chatId, name: task.title })
    await updateTask(task._id, { telegram_topic_id: topic.message_thread_id })
  } catch (e) {
    console.error('createForumTopic', e)
  }
  ctx.reply(messages.taskCreated)
})

bot.command('assign_task', async (ctx) => {
  if (!await verifyAdmin(ctx.from.id)) {
    ctx.reply(messages.unauthorizedAssignTask)
    return
  }
  const parts = ctx.message.text.split(' ').slice(1)
  if (!parts.length) {
    ctx.reply(messages.assignParamsRequired)
    return
  }
  if (parts.length === 2 && parts[0] !== 'group') {
    await assignTask(parts[0], parts[1])
    ctx.reply(messages.taskAssigned)
    return
  }
  let type = 'user'
  let taskId
  if (parts[0] === 'group') {
    type = 'group'
    taskId = parts[1]
  } else {
    taskId = parts[0]
  }
  if (!taskId) {
    ctx.reply(messages.assignParamsRequired)
    return
  }
  pendingAssignments.set(ctx.from.id, { taskId, type })
  const keyboard = type === 'user'
    ? Markup.keyboard([[Markup.button.userRequest('Исполнитель', 1)]])
    : Markup.keyboard([[Markup.button.groupRequest('Группа', 1)]])
  await ctx.reply(
    type === 'user' ? messages.chooseAssignee : messages.chooseGroup,
    keyboard.oneTime().resize()
  )
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
  const res = await fetch(`${botApiUrl || 'https://api.telegram.org'}/file/bot${botToken}/${file_path}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const safeName = file.file_name ? path.basename(file.file_name) : 'photo.jpg'
  const key = `${taskId}/${file.file_unique_id}_${safeName}`
  await uploadFile(buffer, key)
  const url = `${r2.endpoint}/${r2.bucket}/${key}`
  await addAttachment(taskId, { name: safeName, url })
  ctx.reply(messages.fileUploaded)
})

bot.command('upload_voice', async (ctx) => {
  const text = ctx.message.caption || ctx.message.text
  const [, taskId] = text.split(' ')
  if (!taskId) return ctx.reply(messages.uploadParamsRequired)
  const file = ctx.message.voice || ctx.message.audio
  if (!file) return ctx.reply(messages.voiceRequired)
  const { file_path } = await call('getFile', { file_id: file.file_id })
  const res = await fetch(`${botApiUrl || 'https://api.telegram.org'}/file/bot${botToken}/${file_path}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const name = file.file_name ? path.basename(file.file_name) : (ctx.message.voice ? 'voice.ogg' : 'audio.mp3')
  const key = `${taskId}/${file.file_unique_id}_${name}`
  await uploadFile(buffer, key)
  const url = `${r2.endpoint}/${r2.bucket}/${key}`
  await addAttachment(taskId, { name, url })
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
  await sendAccessButton(ctx, url)
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

bot.on('message', async (ctx) => {
  const { user_shared, chat_shared, web_app_data } = ctx.message
  if (user_shared || chat_shared) {
    const pending = pendingAssignments.get(ctx.from.id)
    if (pending) {
      if (user_shared && pending.type === 'user') {
        await assignTask(user_shared.user_id, pending.taskId)
        await ctx.reply(messages.taskAssigned)
        pendingAssignments.delete(ctx.from.id)
      }
      if (chat_shared && pending.type === 'group') {
        await assignGroup(chat_shared.chat_id, pending.taskId)
        await ctx.reply(messages.taskAssigned)
        pendingAssignments.delete(ctx.from.id)
      }
    }
  }
  if (!web_app_data) return
  const data = web_app_data.data
  if (data.startsWith('task_created:')) {
    const id = data.slice('task_created:'.length)
    await ctx.reply(`${messages.taskCreatedInApp} ${id}`)
  }
})

async function startBot () {
  try {
    await bot.launch()
    console.log('Бот запущен')
  } catch (err) {
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
