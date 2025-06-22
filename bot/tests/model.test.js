// Тестирование модели MongoDB. Используется Mongoose модель Task.
process.env.NODE_ENV = 'test'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.JWT_SECRET = 's'
const { Task } = require('../src/db/model')

test('schema has task_description', () => {
  const desc = Task.schema.paths.task_description
  expect(desc).toBeDefined()
})
