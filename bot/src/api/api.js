// HTTP API и мини-приложение. Модули: express, express-rate-limit,
// сервисы и middleware. Используется spaRateLimiter
// для ограничения /{*splat}. Есть маршрут /health для проверки
// статуса.
require('dotenv').config()
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

process.on('unhandledRejection', err => {
  console.error('Unhandled rejection in API:', err)
})
process.on('uncaughtException', err => {
  console.error('Uncaught exception in API:', err)
  process.exit(1)
})
const tasksRouter = require('../routes/tasks')
const authUserRouter = require('../routes/authUser')
const {
  updateTaskStatus,
  createGroup,
  listGroups,
  createUser,
  listUsers,
  createRole,
  listRoles,
  createDepartment,
  listDepartments,
  writeLog,
  listLogs
} = require('../services/service')
const { verifyToken, asyncHandler, errorHandler } = require('./middleware')
const checkRole = require('../middleware/checkRole')

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
  const indexFile = path.join(pub, 'index.html')
  if (!fs.existsSync(indexFile) || fs.statSync(indexFile).size === 0) {
    console.log('Сборка интерфейса...')
    execSync('npm run build-client', { cwd: root, stdio: 'inherit' })
  }
  // доверяем только первому прокси, чтобы получать корректный IP
  // и не допустить обход rate limit по X-Forwarded-For
  app.set('trust proxy', 1)
  app.use(express.json())
  // разрешаем загрузку карт Google во внутренних iframe
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "frame-src": [
            "'self'",
            'https://www.google.com',
            'https://oauth.telegram.org'
          ],
          "script-src": ["'self'", "'unsafe-eval'", 'https://telegram.org'],
          "media-src": ["'self'", 'data:']
        }
      }
    })
  )
  app.use(cors())
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs))

  // простая проверка работоспособности контейнера
  app.get('/health', (_req, res) => res.json({ status: 'ok' }))

  // лимит запросов к группам и пользователям: 100 за 15 минут
  const groupsRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
  })
  const usersRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
  })
  const rolesRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { error: 'Too many requests, please try again later.' }
  })
  const departmentsRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { error: 'Too many requests, please try again later.' }
  })
  const logsRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
  })
  const taskStatusRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { error: 'Too many requests, please try again later.' }
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

  // авторизация реализована через код подтверждения из Telegram


  // Устаревшие маршруты /tasks удалены, используйте /api/tasks


  app.get('/api/groups', groupsRateLimiter, verifyToken, checkRole('admin'), asyncHandler(async (_req, res) => {
    res.json(await listGroups())
  }))
  app.post('/api/groups', groupsRateLimiter, verifyToken, checkRole('admin'),
    validate([body('name').isString().notEmpty()]),
    asyncHandler(async (req, res) => {
    const group = await createGroup(req.body.name)
    res.json(group)
  }))

  app.get('/api/users', usersRateLimiter, verifyToken, checkRole('admin'), asyncHandler(async (_req, res) => {
    res.json(await listUsers())
  }))
  app.post('/api/users', usersRateLimiter, verifyToken, checkRole('admin'),
    validate([
      body('id').isInt(),
      body('username').isString().notEmpty(),
      body('roleId').optional().isMongoId()
    ]),
    asyncHandler(async (req, res) => {
    const user = await createUser(req.body.id, req.body.username, req.body.roleId)
    res.json(user)
  }))

  app.get('/api/departments', departmentsRateLimiter, verifyToken, checkRole('admin'), asyncHandler(async (_req, res) => {
    res.json(await listDepartments())
  }))
  app.post('/api/departments', departmentsRateLimiter, verifyToken, checkRole('admin'),
    validate([body('name').isString().notEmpty()]),
    asyncHandler(async (req, res) => {
    const dep = await createDepartment(req.body.name)
    res.json(dep)
  }))

  /**
   * @swagger
   * /api/roles:
   *   get:
   *     summary: Список ролей
   *     security:
   *       - bearerAuth: []
   */

  app.get('/api/roles', rolesRateLimiter, verifyToken, checkRole('admin'), asyncHandler(async (_req, res) => {

    res.json(await listRoles())
  }))
  /**
   * @swagger
   * /api/roles:
   *   post:
   *     summary: Создать роль
   *     security:
   *       - bearerAuth: []
   */

  app.post('/api/roles', rolesRateLimiter, verifyToken, checkRole('admin'),

    validate([body('name').isString().notEmpty()]),
    asyncHandler(async (req, res) => {
    const role = await createRole(req.body.name)
    res.json(role)
  }))

  /**
   * @swagger
   * /api/logs:
   *   get:
   *     summary: Получить последние логи
   *     security:
   *       - bearerAuth: []
   */

  app.get('/api/logs', logsRateLimiter, verifyToken, checkRole('admin'), asyncHandler(async (_req, res) => {
    res.json(await listLogs())
  }))

  app.post('/api/tasks/:id/status', taskStatusRateLimiter, verifyToken,

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

  // явно обрабатываем корневой адрес, чтобы исключить 403
  app.get('/', spaRateLimiter, (_req, res) => {
    res.sendFile(path.join(pub, 'index.html'))
  })

  // SPA fallback: Express 5 требует имя wildcard-параметра
  // поэтому используем "/{*splat}" вместо устаревшего "*"
  app.get('/{*splat}', spaRateLimiter, (_req, res) => {
    res.sendFile(path.join(pub, 'index.html'))
  })

  app.use(errorHandler)

  const port = config.port
  app.listen(port, () => console.log(`API запущен на порту ${port}`))
})()
