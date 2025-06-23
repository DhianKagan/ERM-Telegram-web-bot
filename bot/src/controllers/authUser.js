// Контроллеры регистрации и входа
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { validationResult } = require('express-validator')
const User = require('../models/User')
const { jwtSecret } = require('../config')

function handle(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
  return next()
}
exports.register = [handle, async (req, res) => {
  const { name, email, password } = req.body
  const hash = await bcrypt.hash(password, 12)
  const user = await User.create({ name, email, passwordHash: hash })
  res.status(201).json({ id: user._id, name: user.name, email: user.email })
}]

exports.login = [handle, async (req, res) => {
  const { email, password } = req.body
  const user = await User.findOne({ email })
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: 'Неверные данные' })
  }
  const token = jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn: '8h' })
  res.json({ token })
}]

exports.profile = async (req, res) => {
  const user = await User.findById(req.user.id).select('-passwordHash')
  res.json(user)
}
