// Контроллер ролей с использованием RolesService
// Основные модули: express-validator, container
const { handleValidation } = require('../utils/validate')
const container = require('../container.ts').default || require('../container.ts')
const service = container.resolve('RolesService')

exports.list = async (_req, res) => {
  res.json(await service.list())
}

exports.update = [
  handleValidation,
  async (req, res) => {
    const role = await service.update(req.params.id, req.body.permissions)
    if (!role) return res.sendStatus(404)
    res.json(role)
  },
]
