/* Назначение файла: инициализация клиента Redis для кеширования.
 * Основные модули: ioredis
 */
const Redis = require('ioredis');
let client;
if (process.env.NODE_ENV === 'test') {
  const RedisMock = require('ioredis-mock');
  client = new RedisMock();
} else {
  client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
}
client.on('error', (err) => {
  console.error('Ошибка Redis:', err);
});
module.exports = client;
