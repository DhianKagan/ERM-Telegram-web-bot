// Скрипт создания администратора по Telegram ID
// Модули: mongoose, dotenv, модели проекта
import mongoose from 'mongoose'
import 'dotenv/config'
import { User, Role } from '../bot/src/db/model.js'

const [ , , idArg, usernameArg ] = process.argv
if (!idArg) {
  console.log('Использование: node scripts/create_admin_user.js <telegram_id> [username]')
  process.exit(1)
}
const telegramId = Number(idArg)
const username = usernameArg || `admin_${telegramId}`

await mongoose.connect(process.env.MONGO_DATABASE_URL)
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
process.exit(0)

