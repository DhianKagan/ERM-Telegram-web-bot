// Тесты сервиса задач. Используются мок модели и функции service.
jest.mock('../../src/db/model', () => ({
  Task: {
    create: jest.fn().mockResolvedValue({ status: 'pending' }),
    findByIdAndUpdate: jest.fn().mockResolvedValue(),
    find: jest.fn().mockResolvedValue([{ id: 1 }])
  },
  Group: {},
  User: {}
}))

const { createTask, assignTask, listUserTasks } = require('../../src/services/service')

test('createTask adds pending task', async () => {
  const task = await createTask('Test')
  expect(task.status).toBe('pending')
})

test('assignTask sets user', async () => {
  await createTask('Another')
  await assignTask(1, 1)
  const list = await listUserTasks(1)
  expect(list).toHaveLength(1)
})
