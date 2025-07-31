// Роут расчёта оптимального маршрута для нескольких машин
// Модули: express, express-validator, controller
const router = require('express').Router()
const { body } = require('express-validator')
const validate = require('../utils/validate')
const ctrl = require('../controllers/optimizer')
const { verifyToken, asyncHandler } = require('../api/middleware')

router.post('/', verifyToken,
  validate([
    body('tasks').isArray({ min: 1 }),
    body('count').optional().isInt({ min: 1, max: 3 }),
    body('method').optional().isIn(['angle', 'trip'])
  ]),
  asyncHandler(ctrl.optimize))

module.exports = router
