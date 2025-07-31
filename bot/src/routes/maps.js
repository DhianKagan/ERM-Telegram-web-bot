// Роут карт: разворачивание ссылок Google Maps
const router = require('express').Router()
const { body } = require('express-validator')
const validate = require('../utils/validate')
const ctrl = require('../controllers/maps')
const { verifyToken, asyncHandler } = require('../api/middleware')

router.post('/expand', verifyToken,
  validate([body('url').isString().notEmpty()]),
  asyncHandler(ctrl.expand))

module.exports = router
