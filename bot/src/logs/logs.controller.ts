// Контроллер логов с использованием LogsService
// Основные модули: express-validator, container
const { validationResult } = require('express-validator')
const container = require('../container.ts').default || require('../container.ts')
const service = container.resolve('LogsService')

function handle(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
  return next()
}

exports.list = async (req, res) => {
  res.json(await service.list(req.query))
}

exports.create = [
  handle,
  async (req, res) => {
    if (typeof req.body.message === 'string') {
      await service.write(req.body.message)
    }
    res.json({ status: 'ok' })
  },
]
