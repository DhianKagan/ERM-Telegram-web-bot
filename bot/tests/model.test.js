process.env.NODE_ENV = 'test'
const Task = require('../src/db/model')

test('schema has task_description', () => {
  const desc = Task.schema.paths.task_description
  expect(desc).toBeDefined()
})
