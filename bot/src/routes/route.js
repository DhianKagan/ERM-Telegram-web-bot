// Роут расчёта расстояния
// Модули: express, express-validator, service
const router = require('express').Router()
const { body, query } = require('express-validator')
const validate = require('../utils/validate')
const { getRouteDistance, table, nearest, match, trip } = require('../services/route')
const { verifyToken, asyncHandler } = require('../api/middleware')


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
