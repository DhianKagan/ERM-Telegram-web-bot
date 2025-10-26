// Назначение: проверка единственного реестра метрик
// Модули: jest
export {};

const { register } = require('../src/metrics');

test('register singleton', () => {
  const { register: again } = require('../src/metrics');
  expect(again).toBe(register);
});
