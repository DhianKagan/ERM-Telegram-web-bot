// HTTP API и мини-приложение. Модули: express, express-rate-limit,
// сервисы и middleware. Используются tasksRateLimiter, loginRateLimiter и
// spaRateLimiter для ограничения /{*splat}. Есть маршрут /health для проверки
// статуса.
const config = require('../config')
const express = require('express')
const rateLimit = require('express-rate-limit')
const helmet = require('helmet')
const cors = require('cors')
const { body, validationResult } = require('express-validator')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')
const { swaggerUi, specs } = require('./swagger')
const tasksRouter = require('../routes/tasks')
const authUserRouter = require('../routes/authUser')
const { createTask, listUserTasks, listAllTasks, updateTaskStatus,
  createGroup, listGroups, createUser, listUsers, updateTask,
  createRole, listRoles, writeLog, listLogs } = require('../services/service')
const { verifyToken, asyncHandler, errorHandler } = require('./middleware')
const { generateToken } = require('../auth/auth')

const validate = validations => [
  ...validations,
  (req, res, next) => {
    const errors = validationResult(req)
    if (errors.isEmpty()) return next()
    res.status(400).json({ errors: errors.array() })
  }
]

;(async () => {
  // подключение моделей и базы данных
  require('../db/model')
  const app = express()
  // при отсутствии статических файлов выполняем сборку мини-приложения
  const root = path.join(__dirname, '../..')
  const pub = path.join(root, 'public')
  if (fs.readdirSync(pub).length <= 1) {
    console.log('Сборка интерфейса...')
    execSync('npm run build-client', { cwd: root, stdio: 'inherit' })
  }
  // доверяем только первому прокси, чтобы получать корректный IP
  // и не допустить обход rate limit по X-Forwarded-For
  app.set('trust proxy', 1)
  app.use(express.json())
  app.use(helmet())
  app.use(cors())
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs))

  // простая проверка работоспособности контейнера
  app.get('/health', (_req, res) => res.json({ status: 'ok' }))

  // лимит запросов к задачам: 100 за 15 минут
  const tasksRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
  })
  // лимит попыток входа: 10 за 15 минут
  const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many login attempts, please try later.' }
  })
  // ограничение обращений к SPA: 50 в минуту
  const spaRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
  })
  app.use(express.static(path.join(__dirname, '../../public')))

  app.post('/auth/login', loginRateLimiter,
    validate([
      body('email').isString().notEmpty(),
      body('password').notEmpty()
    ]),
    asyncHandler(async (req, res) => {
    const { email, password } = req.body
    if (!config.adminEmail || !config.adminPassword) {
      return res.status(500).json({ error: 'Credentials not set' })
    }
    if (email !== config.adminEmail || password !== config.adminPassword) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    const token = generateToken({ id: 0, username: email, isAdmin: true })
    res.json({ token, role: 'admin', name: 'Администратор' })
  }))


  /**
   * @swagger
   * /tasks:
   *   get:
   *     summary: Получить список задач
   *     security:
   *       - bearerAuth: []
   */
  app.get('/tasks', tasksRateLimiter, verifyToken, asyncHandler(async (req, res) => {
    const tasks = req.query.userId ? await listUserTasks(req.query.userId) : await listAllTasks()
    res.json(tasks)
  }))

  app.post('/tasks', verifyToken,
    validate([
      body('description').isString().notEmpty(),
      body('dueDate').optional().isISO8601().custom(d => new Date(d) > new Date()),
      body('priority').optional().isIn(['low', 'medium', 'high']),
      body('groupId').optional().isMongoId(),
      body('userId').optional().isInt()
    ]),
    asyncHandler(async (req, res) => {
    const { description, dueDate, priority, groupId, userId } = req.body
    const task = await createTask(description, dueDate, priority, groupId, userId)
    await writeLog(`Создана задача ${task._id}`)
    res.json(task)
  }))

  app.put('/tasks/:id', verifyToken, asyncHandler(async (req, res) => {
    await updateTask(req.params.id, req.body)
    res.json({ status: 'ok' })
  }))

  app.get('/groups', verifyToken, asyncHandler(async (_req, res) => {
    res.json(await listGroups())
  }))
  app.post('/groups', verifyToken,
    validate([body('name').isString().notEmpty()]),
    asyncHandler(async (req, res) => {
    const group = await createGroup(req.body.name)
    res.json(group)
  }))

  app.get('/users', verifyToken, asyncHandler(async (_req, res) => {
    res.json(await listUsers())
  }))
  app.post('/users', verifyToken,
    validate([
      body('id').isInt(),
      body('username').isString().notEmpty()
    ]),
    asyncHandler(async (req, res) => {
    const user = await createUser(req.body.id, req.body.username)
    res.json(user)
  }))

  /**
   * @swagger
   * /roles:
   *   get:
   *     summary: Список ролей
   *     security:
   *       - bearerAuth: []
   */
  app.get('/roles', verifyToken, asyncHandler(async (_req, res) => {
    res.json(await listRoles())
  }))
  /**
   * @swagger
   * /roles:
   *   post:
   *     summary: Создать роль
   *     security:
   *       - bearerAuth: []
   */
  app.post('/roles', verifyToken,
    validate([body('name').isString().notEmpty()]),
    asyncHandler(async (req, res) => {
    const role = await createRole(req.body.name)
    res.json(role)
  }))

  /**
   * @swagger
   * /logs:
   *   get:
   *     summary: Получить последние логи
   *     security:
   *       - bearerAuth: []
   */
  app.get('/logs', verifyToken, asyncHandler(async (_req, res) => {
    res.json(await listLogs())
  }))

  app.post('/tasks/:id/status', verifyToken,
    validate([body('status').isIn(['pending', 'in-progress', 'completed'])]),
    asyncHandler(async (req, res) => {
      await updateTaskStatus(req.params.id, req.body.status)
      await writeLog(`Статус задачи ${req.params.id} -> ${req.body.status}`)
      res.json({ status: 'ok' })
    }))

  // авторизация пользователей и личный кабинет
  app.use('/api/auth', authUserRouter)
  // новые REST маршруты для расширенной работы с задачами
  app.use('/api/tasks', tasksRouter)

  // SPA fallback: Express 5 требует имя wildcard-параметра
  // поэтому используем "/{*splat}" вместо устаревшего "*"
  app.get('/{*splat}', spaRateLimiter, (_req, res) => {
    res.sendFile(path.join(pub, 'index.html'))
  })

  app.use(errorHandler)

  const port = config.port
  app.listen(port, () => console.log(`API on port ${port}`))
})()
