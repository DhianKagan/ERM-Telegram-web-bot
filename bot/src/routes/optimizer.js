// Роут расчёта оптимального маршрута для нескольких машин
// Модули: express, express-validator, controller
const router = require('express').Router()
const { body, validationResult } = require('express-validator')
const ctrl = require('../controllers/optimizer')
const { verifyToken, asyncHandler } = require('../api/middleware')

const validate = v => [...v, (req, res, next) => {
  const errors = validationResult(req)
  if (errors.isEmpty()) return next()
  res.status(400).json({ errors: errors.array() })
}]

router.post('/', verifyToken,
  validate([
    body('tasks').isArray({ min: 1 }),
    body('count').optional().isInt({ min: 1, max: 3 })
  ]),
  asyncHandler(ctrl.optimize))

module.exports = router
