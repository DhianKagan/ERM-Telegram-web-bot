// Роуты регистрации, входа и профиля
const router = require('express').Router()
const { body } = require('express-validator')
const ctrl = require('../controllers/authUser')
const { verifyToken } = require('../api/middleware')

router.post('/register', [
  body('name').isString().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], ctrl.register)

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], ctrl.login)

router.get('/profile', verifyToken, ctrl.profile)
module.exports = router
