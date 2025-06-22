// Заполнение тестовыми данными
import mongoose from 'mongoose'
import { Task } from '../../bot/src/db/model.js'
import 'dotenv/config'

await Task.create({ task_description: 'Пример', priority: 'high' })
console.log('Добавлена тестовая задача')
process.exit(0)
