// Тестирование загрузки файлов в R2. Используется AWS SDK клиент.
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.JWT_SECRET = 's'
process.env.APP_URL = 'https://localhost'
const { uploadFile, client } = require('../../src/services/r2')

test('uploadFile calls client.send', async () => {
  const spy = jest.spyOn(client, 'send').mockResolvedValue()
  await uploadFile(Buffer.from('test'), 'file.txt')
  expect(spy).toHaveBeenCalled()
  spy.mockRestore()
})
