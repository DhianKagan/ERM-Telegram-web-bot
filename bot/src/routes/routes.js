// Роуты для получения маршрутов
const router = require('express').Router()
const { query, validationResult } = require('express-validator')
const ctrl = require('../controllers/routes')
const { verifyToken, asyncHandler } = require('../api/middleware')

const validate = v => [...v, (req,res,next)=>{
  const errors = validationResult(req)
  if(errors.isEmpty()) return next()
  res.status(400).json({ errors: errors.array() })
}]

router.get('/all', verifyToken,
  validate([
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('department').optional().isMongoId(),
    query('status').optional().isString()
  ]),
  asyncHandler(ctrl.all))

module.exports = router
