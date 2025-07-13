// Тесты сервиса задач. Используются мок модели и функции service.
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.JWT_SECRET = 's'
jest.mock('../../src/db/model', () => ({
  Task: {
    create: jest.fn().mockResolvedValue({ status: 'new' }),
    findByIdAndUpdate: jest.fn().mockResolvedValue(),
    find: jest.fn().mockResolvedValue([{ id: 1 }])
  },
  Group: {},
  User: {}
}))

const { createTask, assignTask, listUserTasks } = require('../../src/services/service')

test('createTask adds new task status', async () => {
  const task = await createTask('Test')
  expect(task.status).toBe('new')
})

test('assignTask sets user', async () => {
  await createTask('Another')
  await assignTask(1, 1)
  const list = await listUserTasks(1)
  expect(list).toHaveLength(1)
})
