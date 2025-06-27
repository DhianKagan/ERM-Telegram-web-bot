// Роуты регистрации, входа и профиля
// Роут только профиля пользователя
const router = require('express').Router()
const ctrl = require('../controllers/authUser')
const { verifyToken, asyncHandler } = require('../api/middleware')
const { body, validationResult } = require('express-validator')

const validate = validations => [
  ...validations,
  (req, res, next) => {
    const errors = validationResult(req)
    if (errors.isEmpty()) return next()
    res.status(400).json({ errors: errors.array() })
  }
]



router.post('/telegram', validate([
  body('id').isInt(),
  body('hash').notEmpty(),
  body('auth_date').isInt(),
  body('username').optional().isString()
]), asyncHandler(ctrl.telegramLogin))

router.get('/profile', verifyToken, ctrl.profile)
module.exports = router
