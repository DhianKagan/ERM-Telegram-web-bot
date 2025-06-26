// Роуты регистрации, входа и профиля
// Роут только профиля пользователя
const router = require('express').Router()
const ctrl = require('../controllers/authUser')
const { verifyToken } = require('../api/middleware')



router.get('/profile', verifyToken, ctrl.profile)
module.exports = router
