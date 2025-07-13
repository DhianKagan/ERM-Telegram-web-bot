// Контроллер оптимизации маршрутов
// Модули: express-validator, services/optimizer
const { validationResult } = require('express-validator')
const service = require('../services/optimizer')

exports.optimize = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
  const routes = await service.optimize(
    req.body.tasks || [],
    req.body.count,
    req.body.method
  )
  res.json({ routes })
}
