// Контроллер маршрутов: список с фильтрами
const service = require('../services/routes')
const { validationResult } = require('express-validator')

exports.all = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
  const filters = {
    from: req.query.from,
    to: req.query.to,
    status: typeof req.query.status === 'string' ? req.query.status : undefined
  }
  res.json(await service.list(filters))
}
