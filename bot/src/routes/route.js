// Роут расчёта расстояния
// Модули: express, express-validator, service
const router = require('express').Router()
const { body, validationResult } = require('express-validator')
const { getRouteDistance } = require('../services/route')
const { verifyToken, asyncHandler } = require('../api/middleware')

const validate = v => [
  ...v,
  (req, res, next) => {
    const errors = validationResult(req)
    if (errors.isEmpty()) return next()
    res.status(400).json({ errors: errors.array() })
  }
]

router.post('/', verifyToken,
  validate([
    body('start.lat').isFloat(),
    body('start.lng').isFloat(),
    body('end.lat').isFloat(),
    body('end.lng').isFloat()
  ]),
  asyncHandler(async (req, res) => {
    const data = await getRouteDistance(req.body.start, req.body.end)
    res.json(data)
  }))

module.exports = router
