const router = require('express').Router()
const authCtrl = require('../controllers/authController')
const { asyncHandler } = require('../api/middleware')
const { body, validationResult } = require('express-validator')

const validate = validations => [
  ...validations,
  (req, res, next) => {
    const errors = validationResult(req)
    if (errors.isEmpty()) return next()
    res.status(400).json({ errors: errors.array() })
  }
]

router.post('/send_code', validate([
  body('telegramId').isInt()
]), asyncHandler(authCtrl.sendAdminCode))

router.post('/verify_code', validate([
  body('telegramId').isInt(),
  body('code').isLength({ min: 4 })
]), asyncHandler(authCtrl.verifyAdminCode))

module.exports = router
