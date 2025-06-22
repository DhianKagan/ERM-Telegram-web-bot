// Роуты регистрации, входа и профиля
const router = require('express').Router()
const ctrl = require('../controllers/authUser')
const { verifyToken } = require('../api/middleware')
router.post('/register', ctrl.register)
router.post('/login', ctrl.login)
router.get('/profile', verifyToken, ctrl.profile)
module.exports = router
