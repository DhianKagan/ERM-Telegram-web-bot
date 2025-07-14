// Основной файл бота Telegram. Использует dotenv, telegraf, сервисы задач,
// загрузку файлов в R2 и JWT-аутентификацию.
require('dotenv').config()
// В режиме разработки скрываем значение BOT_TOKEN
if (process.env.NODE_ENV !== 'production') {
  console.log('BOT_TOKEN загружен')
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
const taskFields = require('../../shared/taskFields.cjs')
const formatTask = require('../utils/formatTask')
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
  listMentionedTasks,
  getTask,
  updateTask,
  updateUser,
  searchTasks,
  addAttachment,
  deleteTask,
  writeLog
} = require('../services/service')
const { getMemberStatus, getTelegramId } = require('../services/userInfoService')
const { uploadFile } = require('../services/r2')
const { call } = require('../services/telegramApi')
const { sendCode } = require('../services/otp')
const { expandMapsUrl, extractCoords } = require('../services/maps')
const { verifyAdmin, generateToken } = require('../auth/auth')
const { startScheduler } = require('../services/scheduler')
const bot = new Telegraf(botToken)
if (typeof bot.use === 'function') {
  bot.use(async (ctx, next) => {
    if (ctx.message?.text) {
      await writeLog(`Бот получил: ${ctx.message.text}`)
    } else if (ctx.callbackQuery?.data) {
      await writeLog(`Бот callback: ${ctx.callbackQuery.data}`)
    }
    return next()
  })
}
require('../db/model')

// Хранилище незавершённых команд /assign_task
const pendingAssignments = new Map()
const pendingComments = new Map()

async function safeEditMessageText(ctx, text, extra) {
  const current = ctx.update?.callback_query?.message?.text
  if (current === text) return
  await ctx.editMessageText(text, extra)
}

// Функция отправки кнопки. По умолчанию используется тип Web App.
// Для открытия во внешнем браузере установите asWebApp = false
async function sendAccessButton(ctx, url, asWebApp = true) {
  const send = async chatId => {
    try {
      await bot.telegram.sendMessage(
        chatId,
        'Нажмите кнопку для доступа',
        Markup.inlineKeyboard([
          asWebApp ? Markup.button.webApp(messages.miniAppLinkText, url) : Markup.button.url(messages.miniAppLinkText, url)
        ])
      )
    } catch (err) {
      if (asWebApp && err.description && err.description.includes('BUTTON_TYPE_INVALID')) {
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
  await ctx.reply(
    messages.menuPrompt,
    Markup.inlineKeyboard([
      Markup.button.callback('Мои задачи', 'my_tasks')
    ])
  )
}

function taskKeyboard(id, route) {
  const rows = [
    [
      Markup.button.callback('📥 Принять', `accept_${id}`),
      Markup.button.callback('✔️ Выполнено', `complete_${id}`)
    ],
    [
      Markup.button.callback('✏️ Изменить', `edit_${id}`),
      Markup.button.callback('❌ Отменить', `cancel_${id}`)
    ]
  ]
  if (route) rows.push([Markup.button.url('📍 Маршрут', route)])
  return Markup.inlineKeyboard(rows)
}

async function refreshTaskMessage(ctx, id) {
  const t = await getTask(id)
  if (!t) return
  const text = formatTask(t)
  await safeEditMessageText(
    ctx,
    text,
    { parse_mode: 'MarkdownV2', disable_web_page_preview: true, ...taskKeyboard(id, t.google_route_url) }
  )
}

// Главное меню с кнопками команд
async function showMainMenu(ctx) {
  await ctx.reply(
    messages.menuPrompt,
    Markup.keyboard([
      ["Справка", "Кто я", "Регистрация"],
      ["Меню задач", "Приложение", "Браузер"]
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
      await ctx.reply(
        formatTask(task),
        { parse_mode: 'MarkdownV2', disable_web_page_preview: true }
      )
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
  const task = await createTask(taskDescription, undefined, 'В течение дня', undefined, ctx.from.id, undefined)
  try {
    const topic = await call('createForumTopic', { chat_id: chatId, name: task.title })
    await updateTask(task._id, { telegram_topic_id: topic.message_thread_id })
  } catch (e) {
    console.error('createForumTopic', e)
  }
  ctx.reply(messages.taskCreated)
})

bot.command('task_form', (ctx) => {
  const text = taskFields.map(f => `• ${f.label}`).join('\n')
  ctx.reply(`${messages.taskForm}\n${text}`)
})

bot.command('task_form_app', async (ctx) => {
  const isAdmin = await verifyAdmin(ctx.from.id)
  const token = generateToken({ id: ctx.from.id, username: ctx.from.username, isAdmin })
  const url = `${appUrl}?token=${token}&newTask=1`
  await sendAccessButton(ctx, url)
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

bot.command('list_tasks', async ctx => {
  const tasks = await listUserTasks(ctx.from.id)
  if (!tasks.length) {
    return ctx.reply(messages.noTasks)
  }
  for (const t of tasks) {
    await ctx.reply(
      formatTask(t),
      {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
        ...taskKeyboard(t._id, t.google_route_url)
      }
    )
  }
})

bot.command('my_tasks', async ctx => {
  const tasks = await listMentionedTasks(ctx.from.id)
  if (!tasks.length) {
    return ctx.reply(messages.noTasks)
  }
  if (tasks.length === 1) {
    const t = tasks[0]
    return ctx.reply(
      formatTask(t),
      {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
        ...taskKeyboard(t._id, t.google_route_url)
      }
    )
  }
  const rows = tasks.map(t => [Markup.button.callback(t.title, `mytask_${t._id}`)])
  await ctx.reply(messages.chooseTask, Markup.inlineKeyboard(rows))
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
      formatTask(t),
      {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
        ...Markup.inlineKeyboard([
          Markup.button.callback('✔️', `done_${t.id}`),
          Markup.button.callback('❌', `del_${t.id}`)
        ])
      }
    )
  }
})

bot.command('task_info', async (ctx) => {
  const id = ctx.message.text.split(' ')[1]
  if (!id) return ctx.reply('Укажите id задачи')
  const t = await getTask(id)
  if (!t) return ctx.reply('Задача не найдена')
  await ctx.reply(
    formatTask(t),
    {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
      ...taskKeyboard(id, t.google_route_url)
    }
  )
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
  try {
    await call('editMessageText', { chat_id: ctx.chat.id, message_id: Number(id), text: text.join(' ') })
  } catch (err) {
    if (err.description && err.description.includes('message is not modified')) {
      await writeLog('Сообщение не изменилось')
    } else {
      throw err
    }
  }
})

bot.on('inline_query', async (ctx) => {
  const parts = ctx.inlineQuery.query.trim().split(/\s+/)
  const cmd = parts.shift()
  const arg = parts.join(' ')
  if (cmd === 'add') {
    if (!arg) return ctx.answerInlineQuery([], { cache_time: 0 })
    const task = await createTask(arg, undefined, 'В течение дня', undefined, ctx.from.id, undefined)
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
      input_message_content: { message_text: formatTask(t) }
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
  const url = `${appUrl}?browser=1&token=${token}`
  await sendAccessButton(ctx, url, false)
})
// Обработка нажатий текстовых кнопок
bot.hears("Справка", (ctx) => ctx.reply(messages.help))

bot.hears("Кто я", async (ctx) => {
  const id = getTelegramId(ctx)
  let status
  try {
    status = await getMemberStatus(id)
  } catch {
    return ctx.reply(messages.accessError)
  }
  ctx.reply(`${messages.idLabel}: ${id}\n${messages.statusLabel}: ${status}`)
})

bot.hears("Регистрация", async (ctx) => {
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

bot.hears("Меню задач", async (ctx) => {
  await showTaskMenu(ctx)
})

bot.hears("Приложение", async (ctx) => {
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

bot.hears("Браузер", async (ctx) => {
  let user = await getUser(ctx.from.id)
  if (!user) {
    await createUser(ctx.from.id, ctx.from.username)
  }
  const isAdmin = await verifyAdmin(ctx.from.id)
  const token = generateToken({ id: ctx.from.id, username: ctx.from.username, isAdmin })
  const url = `${appUrl}?browser=1&token=${token}`
  await sendAccessButton(ctx, url, false)
})

// Ответ на короткую ссылку Google Maps
bot.hears(/https?:\/\/maps\.app\.goo\.gl\/[\S]+/i, async (ctx) => {
  const match = ctx.message.text.match(/https?:\/\/maps\.app\.goo\.gl\/[\S]+/i)
  if (!match) return
  try {
    const full = await expandMapsUrl(match[0])
    const coords = extractCoords(full)
    let msg = `${messages.fullMapLink}: ${full}`
    if (coords) {
      msg += `\n${messages.mapCoords}: ${coords.lat},${coords.lng}`
    }
    await ctx.reply(msg)
  } catch {
    await ctx.reply(messages.mapLinkError)
  }
})

bot.action('my_tasks', async ctx => {
  const tasks = await listMentionedTasks(ctx.from.id)
  if (!tasks.length) {
    await ctx.reply(messages.noTasks)
  } else {
    for (const t of tasks) {
      await ctx.reply(
        formatTask(t),
        {
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true,
          ...taskKeyboard(t._id, t.google_route_url)
        }
      )
    }
  }
  await ctx.answerCbQuery()
})

bot.action('all_tasks', async ctx => {
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
        formatTask(t),
        {
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true,
          ...taskKeyboard(t._id, t.google_route_url)
        }
      )
    }
  }
  await ctx.answerCbQuery()
})

bot.action(/^done_(.+)$/, async ctx => {
  const id = ctx.match[1]
  await updateTaskStatus(id, 'Выполнена')
  await refreshTaskMessage(ctx, id)
  await ctx.answerCbQuery(messages.taskCompleted, { show_alert: false })
})

bot.action(/^accept_(.+)$/, async ctx => {
  const id = ctx.match[1]
  await updateTaskStatus(id, 'В работе')
  await refreshTaskMessage(ctx, id)
  await ctx.answerCbQuery(messages.taskAccepted, { show_alert: false })
})

bot.action(/^complete_(full|partial|changed)_(.+)$/, async ctx => {
  const option = ctx.match[1]
  const id = ctx.match[2]
  await updateTask(id, { status: 'Выполнена', completed_at: new Date(), completion_result: option })
  await refreshTaskMessage(ctx, id)
  await ctx.answerCbQuery(messages.taskCompleted, { show_alert: false })
})

bot.action(/^complete_(.+)$/, async ctx => {
  const id = ctx.match[1]
  await safeEditMessageText(
    ctx,
    'Выберите вариант',
    Markup.inlineKeyboard([
      [Markup.button.callback('Полностью', `complete_full_${id}`)],
      [Markup.button.callback('Частично', `complete_partial_${id}`)],
      [Markup.button.callback('С изменениями', `complete_changed_${id}`)]
    ])
  )
  await ctx.answerCbQuery()
})

bot.action(/^cancel_(technical|canceled|declined)_(.+)$/, async ctx => {
  const reason = ctx.match[1]
  const id = ctx.match[2]
  await updateTask(id, { status: 'Отменена', cancel_reason: reason })
  await refreshTaskMessage(ctx, id)
  await ctx.answerCbQuery(messages.taskCanceled, { show_alert: false })
})

bot.action(/^cancel_(.+)$/, async ctx => {
  const id = ctx.match[1]
  await safeEditMessageText(
    ctx,
    'Причина отмены?',
    Markup.inlineKeyboard([
      [Markup.button.callback('Технические', `cancel_technical_${id}`)],
      [Markup.button.callback('Отмена', `cancel_canceled_${id}`)],
      [Markup.button.callback('Отказ исполнителя', `cancel_declined_${id}`)]
    ])
  )
  await ctx.answerCbQuery()
})

bot.action(/^mytask_(.+)$/, async ctx => {
  const id = ctx.match[1]
  const t = await getTask(id)
  if (!t) {
    await ctx.answerCbQuery('Задача не найдена', { show_alert: true })
    return
  }
  await safeEditMessageText(
    ctx,
    formatTask(t),
    {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
      ...taskKeyboard(id, t.google_route_url)
    }
  )
  await ctx.answerCbQuery()
})

bot.action(/^edit_(.+)$/, async ctx => {
  const id = ctx.match[1]
  pendingComments.set(ctx.from.id, id)
  await ctx.reply(messages.enterComment)
  await ctx.answerCbQuery()
})

bot.action(/^del_(.+)$/, async (ctx) => {
  const id = ctx.match[1]
  await deleteTask(id)
  await ctx.answerCbQuery(messages.taskDeleted, { show_alert: false })
  await safeEditMessageText(ctx, messages.taskDeleted)
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
  const pendingComment = pendingComments.get(ctx.from.id)
  if (pendingComment && ctx.message.text) {
    await updateTask(pendingComment, { comment: ctx.message.text })
    await ctx.reply('Комментарий сохранён')
    pendingComments.delete(ctx.from.id)
    return
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
    await bot.telegram.deleteWebhook()
    await bot.launch({ dropPendingUpdates: true })
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
