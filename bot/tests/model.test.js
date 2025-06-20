// Тестирование модели MongoDB. Используется Mongoose модель Task.
process.env.NODE_ENV = 'test'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
const Task = require('../src/db/model')

test('schema has task_description', () => {
  const desc = Task.schema.paths.task_description
  expect(desc).toBeDefined()
})
