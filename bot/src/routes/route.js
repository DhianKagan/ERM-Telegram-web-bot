// Роут расчёта расстояния
// Модули: express, express-validator, service
const router = require('express').Router()
const { body, query, validationResult } = require('express-validator')
const { getRouteDistance, table, nearest, match, trip } = require('../services/route')
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

router.get('/table', verifyToken,
  validate([query('points').isString()]),
  asyncHandler(async (req, res) => {
    const { points, ...params } = req.query
    res.json(await table(points, params))
  }))

router.get('/nearest', verifyToken,
  validate([query('point').isString()]),
  asyncHandler(async (req, res) => {
    const { point, ...params } = req.query
    res.json(await nearest(point, params))
  }))

router.get('/match', verifyToken,
  validate([query('points').isString()]),
  asyncHandler(async (req, res) => {
    const { points, ...params } = req.query
    res.json(await match(points, params))
  }))

router.get('/trip', verifyToken,
  validate([query('points').isString()]),
  asyncHandler(async (req, res) => {
    const { points, ...params } = req.query
    res.json(await trip(points, params))
  }))

module.exports = router
