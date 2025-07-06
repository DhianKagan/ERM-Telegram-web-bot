// Роут карт: разворачивание ссылок Google Maps
const router = require('express').Router()
const { body, validationResult } = require('express-validator')
const ctrl = require('../controllers/maps')
const { verifyToken, asyncHandler } = require('../api/middleware')

const validate = v => [
  ...v,
  (req, res, next) => {
    const errors = validationResult(req)
    if (errors.isEmpty()) return next()
    res.status(400).json({ errors: errors.array() })
  }
]

router.post('/expand', verifyToken,
  validate([body('url').isString().notEmpty()]),
  asyncHandler(ctrl.expand))

module.exports = router
