// Контроллер ролей с использованием RolesService
// Основные модули: express-validator, container
const { validationResult } = require('express-validator')
const container = require('../container.ts').default || require('../container.ts')
const service = container.resolve('RolesService')

function handle(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
  return next()
}

exports.list = async (_req, res) => {
  res.json(await service.list())
}

exports.update = [
  handle,
  async (req, res) => {
    const role = await service.update(req.params.id, req.body.permissions)
    if (!role) return res.sendStatus(404)
    res.json(role)
  },
]
