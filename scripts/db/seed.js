// Заполнение тестовыми данными
import mongoose from 'mongoose'
import { Task, Group, User, Log } from '../../bot/src/db/model.js'
import 'dotenv/config'

const group = await Group.create({ name: 'Default' })
const user = await User.create({ telegram_id: 1, username: 'admin', role: 'admin' })
await Task.create({
  title: 'Тестовая задача',
  task_description: 'Пример',
  priority: 'Срочно',
  group_id: group._id,
  assigned_user_id: user.telegram_id
})
await Log.create({ message: 'База заполнена' })
console.log('Добавлены тестовые документы')
process.exit(0)
