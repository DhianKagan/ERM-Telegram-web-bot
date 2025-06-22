// Заполнение тестовыми данными
import mongoose from 'mongoose'
import { Task, Group, User } from '../../bot/src/db/model.js'
import 'dotenv/config'

const group = await Group.create({ name: 'Default' })
const user = await User.create({ telegram_id: 1, username: 'admin' })
await Task.create({
  task_description: 'Пример',
  priority: 'high',
  group_id: group._id,
  assigned_user_id: user.telegram_id
})
console.log('Добавлены тестовые документы')
process.exit(0)
