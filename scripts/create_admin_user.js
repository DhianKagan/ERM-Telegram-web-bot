#!/usr/bin/env node
// Скрипт создания администратора по Telegram ID
// Модули: mongoose, dotenv, модели проекта
require('dotenv').config()

let mongoose
try {
  mongoose = require('mongoose')
} catch (e) {
  mongoose = require('../bot/node_modules/mongoose')
}

const { User, Role } = require('../bot/src/db/model')

const [, , idArg, usernameArg] = process.argv
if (!idArg) {
  console.log('Использование: node scripts/create_admin_user.js <telegram_id> [username]')
  process.exit(1)
}
const telegramId = Number(idArg)
const username = usernameArg || `admin_${telegramId}`

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_DATABASE_URL)
  } catch (e) {
    console.error('Ошибка подключения к MongoDB:', e.message)
    process.exit(1)
  }
  let role = await Role.findOne({ name: 'admin' })
  if (!role) role = await Role.create({ name: 'admin' })
  let user = await User.findOne({ telegram_id: telegramId })
  if (!user) {
    user = await User.create({
      telegram_id: telegramId,
      username,
      email: `${telegramId}@telegram.local`,
      roleId: role._id
    })
  } else {
    user.roleId = role._id
    user.username = username
    await user.save()
  }
  console.log('Администратор создан:', user.telegram_id)
  await mongoose.disconnect()
}

main().catch(e => {
  console.error('Ошибка:', e.message)
  process.exit(1)
})

