// Тесты обновления отдела, проверяем сохранение имени

process.env.NODE_ENV='test'
process.env.BOT_TOKEN='t'
process.env.CHAT_ID='1'
process.env.JWT_SECRET='s'
process.env.MONGO_DATABASE_URL='mongodb://localhost/db'

const { stopScheduler } = require('../src/services/scheduler')
const { stopQueue } = require('../src/services/messageQueue')

jest.mock('../src/db/model', () => ({
  Department: {
    findByIdAndUpdate: jest.fn(async (_id, data) => ({ _id, ...data.$set })),
  }
}))

const { updateDepartment } = require('../src/db/queries')
const { Department } = require('../src/db/model')

test('updateDepartment сохраняет строку в поле name', async () => {
  const result = await updateDepartment('1', 'Отдел')
  expect(result.name).toBe('Отдел')
  expect(Department.findByIdAndUpdate).toHaveBeenCalledWith('1', { $set: { name: 'Отдел' } }, { new: true })
})

afterAll(() => { stopScheduler(); stopQueue() })
