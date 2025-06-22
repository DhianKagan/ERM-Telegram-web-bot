// Наполнение базы тестовыми данными
const mongoose = require('mongoose')
const { Task, User } = require('../bot/src/db/model')

async function main() {
  await mongoose.connect(process.env.MONGO_DATABASE_URL)
  await User.deleteMany()
  await Task.deleteMany()
  const user = await User.create({ telegram_id: 1, username: 'admin' })
  await Task.create({ task_description: 'Первое задание', assigned_user_id: user._id })
  console.log('Данные загружены')
  await mongoose.disconnect()
}

main().catch(console.error)
