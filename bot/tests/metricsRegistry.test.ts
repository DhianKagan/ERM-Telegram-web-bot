// Назначение: проверка единственного реестра метрик
// Модули: jest
const { register } = require('../src/metrics');

test('register singleton', () => {
  const { register: again } = require('../src/metrics');
  expect(again).toBe(register);
});
