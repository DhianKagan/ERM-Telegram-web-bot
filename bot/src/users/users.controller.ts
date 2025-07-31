// Контроллер пользователей с использованием UsersService
// Основные модули: express-validator, container, utils/formatUser
const { handleValidation } = require('../utils/validate')
const container = require('../container.ts').default || require('../container.ts')
const service = container.resolve('UsersService')
const formatUser = require('../utils/formatUser')

exports.list = async (_req, res) => {
  const users = await service.list()
  res.json(users.map(u => formatUser(u)))
}

exports.create = [
  handleValidation,
  async (req, res) => {
    const user = await service.create(req.body.id, req.body.username, req.body.roleId)
    res.status(201).json(formatUser(user))
  },
]
