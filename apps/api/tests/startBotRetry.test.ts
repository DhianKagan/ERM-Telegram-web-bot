// Назначение: проверка повторных запусков бота при ошибках Telegram. Модули: jest, bot.
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.NODE_ENV = 'test';
process.env.SUPPRESS_JEST_WARNINGS = 'true';

jest.mock('telegraf', () => {
  const launch = jest.fn();
  const telegram = {
    deleteWebhook: jest.fn().mockResolvedValue(undefined),
    setWebhook: jest.fn().mockResolvedValue(undefined),
    callApi: jest.fn().mockResolvedValue(undefined),
  };
  class TelegrafMock {
    telegram = telegram;
    launch = launch;
    start = jest.fn();
    command = jest.fn();
    hears = jest.fn();
    action = jest.fn();
    stop = jest.fn();
  }
  return {
    Telegraf: TelegrafMock,
    Markup: { keyboard: () => ({ resize: () => ({}) }) },
    Context: class {},
    __launch: launch,
    __telegram: telegram,
  };
});

test('startBot ограничивает число попыток и применяет backoff', async () => {
  jest.useFakeTimers();
  const exitSpy = jest
    .spyOn(process, 'exit')
    .mockImplementation(
      (() => undefined) as unknown as (code?: number) => never,
    );
  const timeout = jest.spyOn(global, 'setTimeout');
  const { startBot, __resetCloseThrottleForTests } = await import(
    '../src/bot/bot'
  );
  __resetCloseThrottleForTests();
  const { __launch } = (await import('telegraf')) as unknown as {
    __launch: jest.Mock;
  };
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
  jest.useRealTimers();
}, 20000);

test('startBot завершает предыдущую long polling сессию при конфликте 409', async () => {
  jest.useFakeTimers();
  const { startBot, __resetCloseThrottleForTests } = await import(
    '../src/bot/bot'
  );
  __resetCloseThrottleForTests();
  const { __launch, __telegram } = (await import('telegraf')) as unknown as {
    __launch: jest.Mock;
    __telegram: {
      deleteWebhook: jest.Mock;
      callApi: jest.Mock;
    };
  };
  __launch.mockRejectedValueOnce({ response: { error_code: 409 } });
  __launch.mockResolvedValue(undefined);

  const promise = startBot();
  await Promise.resolve();
  await jest.runAllTimersAsync();
  await promise;

  expect(__telegram.deleteWebhook).toHaveBeenCalledWith({
    drop_pending_updates: true,
  });
  expect(__telegram.callApi).toHaveBeenCalledWith('close', {});
  jest.useRealTimers();
});

test('startBot ожидает retry_after после ошибки 429 метода close', async () => {
  jest.useFakeTimers();
  const timeoutSpy = jest.spyOn(global, 'setTimeout');
  const { startBot, __resetCloseThrottleForTests } = await import(
    '../src/bot/bot'
  );
  __resetCloseThrottleForTests();
  const { __launch, __telegram } = (await import('telegraf')) as unknown as {
    __launch: jest.Mock;
    __telegram: {
      callApi: jest.Mock;
      deleteWebhook: jest.Mock;
    };
  };
  const retryAfterSeconds = 3;

  __launch.mockClear();
  __telegram.callApi.mockClear();
  __telegram.deleteWebhook.mockClear();

  __launch.mockRejectedValueOnce({ response: { error_code: 409 } });
  __launch.mockResolvedValue(undefined);
  __telegram.callApi
    .mockRejectedValueOnce({
      error_code: 429,
      response: {
        error_code: 429,
        parameters: { retry_after: retryAfterSeconds },
      },
      parameters: { retry_after: retryAfterSeconds },
    })
    .mockResolvedValue(undefined);

  __telegram.deleteWebhook.mockResolvedValue(undefined);

  timeoutSpy.mockClear();

  const promise = startBot();

  await jest.runAllTimersAsync();
  await promise;

  expect(__telegram.deleteWebhook).toHaveBeenCalledWith({
    drop_pending_updates: true,
  });
  expect(__telegram.callApi).toHaveBeenCalledWith('close', {});

  const delays = timeoutSpy.mock.calls.map((call) => call[1]);
  expect(delays).toContain(retryAfterSeconds * 1000);
  expect(
    delays.filter((value) => value === retryAfterSeconds * 1000).length,
  ).toBeGreaterThanOrEqual(1);
  expect(delays).toContain(1000);

  expect(__launch).toHaveBeenCalledTimes(2);

  timeoutSpy.mockRestore();
  jest.useRealTimers();
});

test('startBot не вызывает close повторно, пока действует throttling', async () => {
  jest.useFakeTimers();
  const { startBot, __resetCloseThrottleForTests } = await import(
    '../src/bot/bot'
  );
  __resetCloseThrottleForTests();
  const { __launch, __telegram } = (await import('telegraf')) as unknown as {
    __launch: jest.Mock;
    __telegram: {
      callApi: jest.Mock;
      deleteWebhook: jest.Mock;
    };
  };
  const retryAfterSeconds = 5;

  __launch.mockClear();
  __telegram.callApi.mockClear();
  __telegram.deleteWebhook.mockClear();

  __launch
    .mockRejectedValueOnce({ response: { error_code: 409 } })
    .mockRejectedValueOnce({ response: { error_code: 409 } })
    .mockResolvedValue(undefined);

  __telegram.callApi
    .mockRejectedValueOnce({
      error_code: 429,
      response: {
        error_code: 429,
        parameters: { retry_after: retryAfterSeconds },
      },
      parameters: { retry_after: retryAfterSeconds },
    })
    .mockResolvedValue(undefined);

  const promise = startBot();

  await jest.runAllTimersAsync();
  await promise;

  expect(__telegram.callApi).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
});

test('startBot настраивает webhook при TELEGRAM_WEBHOOK_URL', async () => {
  jest.resetModules();
  process.env.TELEGRAM_WEBHOOK_URL = 'https://example.com/telegram/webhook';
  process.env.TELEGRAM_WEBHOOK_SECRET = 'secret-token';

  const { startBot } = await import('../src/bot/bot');
  const { __launch, __telegram } = (await import('telegraf')) as unknown as {
    __launch: jest.Mock;
    __telegram: {
      setWebhook: jest.Mock;
    };
  };

  __launch.mockClear();
  __telegram.setWebhook.mockClear();

  await startBot();

  expect(__telegram.setWebhook).toHaveBeenCalledWith(
    'https://example.com/telegram/webhook',
    {
      drop_pending_updates: true,
      secret_token: 'secret-token',
    },
  );
  expect(__launch).not.toHaveBeenCalled();

  delete process.env.TELEGRAM_WEBHOOK_URL;
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
});
