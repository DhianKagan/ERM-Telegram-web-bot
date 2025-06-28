// Проверка BOT_API_URL и загрузки больших файлов
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.JWT_SECRET = 's'
process.env.APP_URL = 'https://localhost'
process.env.BOT_API_URL = 'http://localhost:8081'

const telegramApi = require('../src/services/telegramApi')
const { uploadFile, client } = require('../src/services/r2')

test('telegramApi использует BOT_API_URL', async () => {
  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ ok: true, result: 1 }) })
  await telegramApi.call('getMe')
  expect(fetch).toHaveBeenCalledWith(
    'http://localhost:8081/bott/getMe',
    expect.objectContaining({ method: 'POST' })
  )
})

test('uploadFile принимает большой буфер', async () => {
  const buf = Buffer.alloc(1024 * 1024) // 1 МБ, имитация большого файла
  const spy = jest.spyOn(client, 'send').mockResolvedValue()
  await uploadFile(buf, 'big.bin')
  expect(spy).toHaveBeenCalled()
})
