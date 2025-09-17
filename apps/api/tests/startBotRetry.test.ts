// Назначение: проверка повторных запусков бота при ошибках Telegram. Модули: jest, bot.
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.NODE_ENV = 'test';
process.env.SUPPRESS_JEST_WARNINGS = 'true';

jest.mock('../src/services/wialon', () => ({
  __esModule: true,
  DEFAULT_BASE_URL: 'https://hst-api.wialon.com',
  decodeLocatorKey: (value: string) => value,
}));

jest.mock('telegraf', () => {
  const launch = jest.fn();
  const telegram = { deleteWebhook: jest.fn().mockResolvedValue(undefined) };
  class TelegrafMock {
    telegram = telegram;
    launch = launch;
    start = jest.fn();
    command = jest.fn();
    hears = jest.fn();
    stop = jest.fn();
  }
  return {
    Telegraf: TelegrafMock,
    Markup: { keyboard: () => ({ resize: () => ({}) }) },
    Context: class {},
    __launch: launch,
  };
});

test('startBot ограничивает число попыток и применяет backoff', async () => {
  jest.useFakeTimers();
  const exitSpy = jest
    .spyOn(process, 'exit')
    .mockImplementation((() => undefined) as any);
  const timeout = jest.spyOn(global, 'setTimeout');
  const { startBot } = await import('../src/bot/bot');
  const { __launch } = require('telegraf');
  __launch.mockRejectedValue({ response: { error_code: 502 } });

  const promise = startBot();
  const expectation = expect(promise).rejects.toBeDefined();
  await Promise.resolve();
  await jest.runAllTimersAsync();
  await expectation;
  const delays = timeout.mock.calls.map((c) => c[1]);
  expect(delays).toEqual([1000, 2000, 4000, 8000, 16000]);
  expect(__launch).toHaveBeenCalledTimes(6);
  expect(exitSpy).not.toHaveBeenCalled();
  exitSpy.mockRestore();
  timeout.mockRestore();
}, 10000);
