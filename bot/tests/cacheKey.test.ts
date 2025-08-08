process.env.APP_URL = 'https://localhost';
const { buildCacheKey } = require('../src/services/route');

test('формирует корректный ключ кеша', () => {
  const key = buildCacheKey('table', '1,1;2,2', { annotations: 'duration' });
  expect(key).toBe('table:1,1;2,2:annotations=duration');
});
