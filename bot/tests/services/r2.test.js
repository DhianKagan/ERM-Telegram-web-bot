const { uploadFile, client } = require('../../src/services/r2')

test('uploadFile calls client.send', async () => {
  const spy = jest.spyOn(client, 'send').mockResolvedValue()
  await uploadFile(Buffer.from('test'), 'file.txt')
  expect(spy).toHaveBeenCalled()
  spy.mockRestore()
})
