// Роуты регистрации, входа и профиля
const router = require('express').Router()
const { body } = require('express-validator')
const rateLimit = require('express-rate-limit')
const ctrl = require('../controllers/authUser')
const { verifyToken } = require('../api/middleware')

// Ограничиваем частоту логина: не более 5 запросов в минуту
const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: 5 })

router.post('/register', [
  body('name').isString().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], ctrl.register)

router.post('/login', loginLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], ctrl.login)

router.get('/profile', verifyToken, ctrl.profile)
module.exports = router
