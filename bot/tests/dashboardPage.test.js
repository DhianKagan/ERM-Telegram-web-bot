// Пример теста для Dashboard: проверяем обработку метрик
function calcTotal(tasks) {
  return tasks.length
}

const { stopScheduler } = require('../src/services/scheduler')

test('calcTotal считает количество задач', () => {
  expect(calcTotal([{id:1},{id:2}])).toBe(2)
})

afterAll(() => stopScheduler())
