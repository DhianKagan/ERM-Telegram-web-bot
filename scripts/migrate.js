// Создание индексов MongoDB
const mongoose = require('mongoose')
const { Task, Group, User, Log } = require('../bot/src/db/model')

async function main() {
  await mongoose.connect(process.env.MONGO_DATABASE_URL)
  await Promise.all([
    Task.createIndexes(),
    Group.createIndexes(),
    User.createIndexes(),
    Log.createIndexes()
  ])
  console.log('Индексы созданы')
  await mongoose.disconnect()
}

main().catch(console.error)
