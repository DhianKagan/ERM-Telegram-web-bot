process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.JWT_SECRET = 's'

const { enqueue, queue } = require('../src/services/messageQueue')

test('очередь замедляет отправку при большом числе задач', async () => {
  const start = Date.now()
  const jobs = []
  for (let i = 0; i < 60; i++) {
    jobs.push(enqueue(() => Promise.resolve()))
  }
  await Promise.all(jobs)
  const duration = Date.now() - start
  expect(duration).toBeGreaterThanOrEqual(900)
  expect(queue.length).toBe(0)
})

