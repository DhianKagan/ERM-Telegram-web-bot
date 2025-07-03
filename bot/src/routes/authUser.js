// Роуты регистрации, входа и профиля
// Роут только профиля пользователя
const router = require('express').Router()
const ctrl = require('../controllers/authUser')
const authCtrl = require('../controllers/authController')
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




router.post('/send_code', validate([
  body('phone').optional().isMobilePhone('any'),
  body('telegramId').optional().isInt()
]), asyncHandler(authCtrl.sendCode))

router.post('/verify_code', validate([
  body('phone').optional().isMobilePhone('any'),
  body('telegramId').optional().isInt(),
  body('code').isLength({ min: 4 })
]), asyncHandler(authCtrl.verifyCode))

router.get('/profile', verifyToken, ctrl.profile)
module.exports = router
