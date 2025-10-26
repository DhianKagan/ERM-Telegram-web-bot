// Назначение: проверка сборки ключей кеша OSRM
// Основные модули: services/route
export {};

process.env.APP_URL = 'https://localhost';
const { buildCacheKey } = require('../src/services/route');

describe('сборка ключей кеша', () => {
  test('порядок параметров не влияет', () => {
    const a = buildCacheKey('table', '1,1;2,2', { a: 1, b: 2 });
    const b = buildCacheKey('table', '1,1;2,2', { b: 2, a: 1 });
    expect(a).toBe(b);
  });
});
