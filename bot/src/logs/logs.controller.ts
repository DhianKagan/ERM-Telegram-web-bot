// Контроллер логов с использованием LogsService
// Основные модули: express-validator, container
const { handleValidation } = require('../utils/validate')
const container = require('../container.ts').default || require('../container.ts')
const service = container.resolve('LogsService')

exports.list = async (req, res) => {
  res.json(await service.list(req.query))
}

exports.create = [
  handleValidation,
  async (req, res) => {
    if (typeof req.body.message === 'string') {
      await service.write(req.body.message)
    }
    res.json({ status: 'ok' })
  },
]
