// Назначение: автотесты. Модули: jest.
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const originalEnv = { ...process.env };

afterEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

test('listLogs фильтрует по уровню и сообщению', async () => {
  jest.resetModules();
  process.env.SUPPRESS_LOGS = '0';
  const { writeLog, listLogs } = require('../../src/services/wgLogEngine');
  await writeLog('Первый лог', 'info');
  await writeLog('Ошибка загрузки', 'error', { scope: 'storage' });
  await writeLog('Второй лог', 'warn', { scope: 'other' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const errors = await listLogs({ level: 'error' });
  expect(errors).toHaveLength(1);
  expect(errors[0].message).toBe('Ошибка загрузки');
  expect(errors[0].metadata).toEqual({ scope: 'storage' });

  const search = await listLogs({ message: 'второй' });
  expect(search).toHaveLength(1);
  expect(search[0].level).toBe('warn');
});

test('при отключении логов возвращается пустой массив', async () => {
  process.env.SUPPRESS_LOGS = '1';
  jest.resetModules();
  const { writeLog, listLogs } = require('../../src/services/wgLogEngine');
  await writeLog('Сообщение', 'info');
  await expect(listLogs()).resolves.toEqual([]);
});

test('listLogs учитывает traceId и диапазон дат', async () => {
  jest.resetModules();
  process.env.SUPPRESS_LOGS = '0';
  const { writeLog, listLogs } = require('../../src/services/wgLogEngine');
  await writeLog('Старое сообщение', 'info');
  const from = new Date().toISOString();
  await writeLog('Новое сообщение', 'info', { traceId: 'custom-trace' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const result = await listLogs({ from });
  expect(result).toHaveLength(1);
  expect(result[0].message).toBe('Новое сообщение');
});
