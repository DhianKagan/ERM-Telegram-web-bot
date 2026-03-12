/**
 * Назначение файла: unit-тесты экспортов Telegram-бота.
 * Основные модули: bot.ts, jest моки зависимостей.
 */
import type { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

const deleteWebhookMock = jest.fn();
const launchMock = jest.fn();
const stopMock = jest.fn();
const inlineKeyboardMock = jest.fn();
const telegrafInstances: unknown[] = [];

jest.mock('../apps/api/src/config', () => ({
  botToken: 'test-token',
  getChatId: jest.fn(() => '123'),
  chatId: '123',
  appUrl: 'https://app.local',
  routingUrl: 'http://localhost:5000/route/v1/driving',
}));

jest.mock('telegraf', () => {
  class TelegrafMock {
    public telegram = {
      deleteWebhook: deleteWebhookMock,
      callApi: jest.fn().mockResolvedValue(undefined),
      editMessageText: jest.fn().mockResolvedValue(undefined),
      sendMessage: jest.fn().mockResolvedValue(undefined),
      getChatMember: jest.fn().mockResolvedValue({ status: 'member' }),
    };

    public launch = launchMock;

    public stop = stopMock;

    public command = jest.fn();

    public hears = jest.fn();

    public start = jest.fn();

    public action = jest.fn();

    public on = jest.fn();

    constructor(public token?: string) {
      telegrafInstances.push(token);
    }
  }

  return {
    Telegraf: TelegrafMock,
    Markup: { inlineKeyboard: inlineKeyboardMock },
    Context: class {},
  };
});

const messagesProxy = new Proxy<Record<string, string>>(
  {},
  {
    get: (_target, prop: string) => `msg:${prop}`,
  },
);

jest.mock('../apps/api/src/messages', () => ({
  __esModule: true,
  default: messagesProxy,
}));

const serviceMock = {
  createUser: jest.fn(),
  getTask: jest.fn(),
  getUser: jest.fn(),
  updateTask: jest.fn(),
  writeLog: jest.fn(),
};

jest.mock('../apps/api/src/services/service', () => serviceMock);

const fleetLeanMock = jest.fn().mockResolvedValue([]);
const fleetSortMock = jest.fn().mockReturnValue({ lean: fleetLeanMock });
const fleetFindMock = jest
  .fn()
  .mockReturnValue({ sort: fleetSortMock, lean: fleetLeanMock });

jest.mock('../apps/api/src/db/models/fleet', () => ({
  FleetVehicle: { find: fleetFindMock },
}));

jest.mock('../apps/api/src/db/model', () => ({}));

jest.mock('../apps/api/src/utils/taskButtons', () => ({
  taskAcceptConfirmKeyboard: jest.fn(() => ({ type: 'accept' })),
  taskDoneConfirmKeyboard: jest.fn(() => ({ type: 'done' })),
  taskCancelConfirmKeyboard: jest.fn(() => ({ type: 'cancel' })),
  taskStatusInlineMarkup: jest.fn(() => ({ type: 'status' })),
}));

jest.mock('../apps/api/src/utils/taskStatusIcons', () => ({
  TASK_STATUS_ICON_MAP: {
    Новая: '🆕',
    'В работе': '🛠',
    Выполнена: '✅',
    Отменена: '🚫',
  },
}));

jest.mock('../apps/api/src/utils/messageLink', () =>
  jest.fn(() => 'https://tg/link'),
);

jest.mock('../apps/api/src/utils/formatTask', () =>
  jest.fn(() => 'formatted task'),
);

const queriesMock = {
  createTask: jest.fn(),
  getUsersMap: jest.fn().mockResolvedValue({}),
};

jest.mock('../apps/api/src/db/queries', () => queriesMock);

const taskMessagesMock = {
  buildHistorySummaryLog: jest.fn(() => 'Итоговая история'),
  getTaskIdentifier: jest.fn(() => 'ERM-42'),
};

jest.mock('../apps/api/src/tasks/taskMessages', () => taskMessagesMock);

const buildTaskAppLinkMock = jest.fn(() => 'https://app.local/tasks/1');

jest.mock('../apps/api/src/tasks/taskLinks', () => ({
  buildTaskAppLink: buildTaskAppLinkMock,
}));

jest.mock('shared', () => ({
  PROJECT_TIMEZONE: 'Europe/Kyiv',
  PROJECT_TIMEZONE_LABEL: 'Europe/Kyiv',
  buildTaskAppLink: jest.fn(() => 'https://shared/link'),
  extractCoords: jest.fn(() => null),
}));

const taskSyncCtor = jest.fn();

jest.mock('../apps/api/src/controllers/taskSync.controller', () => ({
  __esModule: true,
  default: class {
    constructor(bot: unknown) {
      taskSyncCtor(bot);
    }
  },
}));

jest.mock('../apps/api/src/utils/taskAlbumLink', () => ({
  resolveTaskAlbumLink: jest.fn(() => null),
}));

jest.mock('../apps/api/src/tasks/taskComments', () => ({
  buildCommentHtml: jest.fn(() => '<p>Комментарий</p>'),
}));

jest.mock('../apps/api/src/utils/attachments', () => ({
  buildAttachmentsFromCommentHtml: jest.fn(() => []),
}));

jest.mock('../apps/api/src/utils/accessMask', () => ({
  ACCESS_ADMIN: 8,
  hasAccess: (mask: number, required: number) => (mask & required) === required,
}));

const loadBotModule = () => {
  jest.resetModules();
  deleteWebhookMock.mockResolvedValue(undefined);
  launchMock.mockResolvedValue(undefined);
  inlineKeyboardMock.mockImplementation(
    (rows: InlineKeyboardMarkup['inline_keyboard']) => ({
      inline_keyboard: rows,
    }),
  );
  process.env.NODE_ENV = 'test';
  process.env.BOT_TOKEN = 'test-token';
  let mod: typeof import('../apps/api/src/bot/bot');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../apps/api/src/bot/bot');
  });
  return mod!;
};

describe('helpers из bot.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    telegrafInstances.length = 0;
  });

  test('buildDirectTaskMessage формирует разметку для задачи', () => {
    const { buildDirectTaskMessage } = loadBotModule();
    const message = buildDirectTaskMessage(
      {
        status: 'В работе',
        title: '  Проверка  ',
        due_date: '2025-10-29T12:00:00.000Z',
        start_location: ' Склады ',
        start_location_link: 'https://start',
        startCoordinates: { lat: 50.45, lng: 30.523 },
        end_location: 'Финиш',
        end_location_link: 'https://finish',
        finishCoordinates: { lat: 51.0, lng: 31.0 },
        route_distance_km: 15,
        assignees: [1, '2', 'нет'],
      } as Record<string, unknown> & { status: 'В работе' },
      'https://t.me/msg',
      {
        1: { name: 'Иван', username: 'ivan', isBot: false },
        2: { name: '', username: 'maria', isBot: false },
      },
      'https://app.local/tasks/1',
      { note: ' Срочно ' },
    );

    expect(message.startsWith('<i>Срочно</i>')).toBe(true);
    expect(message).toContain('<a href="https://t.me/msg">ERM-42</a>');
    expect(message).toContain('Название: <b>Проверка</b>');
    expect(message).toContain('Статус: <b>🛠 В работе</b>');
    expect(message).toContain('Europe/Kyiv)');
    expect(message).toContain(
      'Старт: <a href="https://start">Склады</a> (<code>50.45000, 30.52300</code>)',
    );
    expect(message).toContain(
      'Финиш: <a href="https://finish">Финиш</a> (<code>51.00000, 31.00000</code>)',
    );
    expect(message).toContain('Логистика: <b>15 км</b>');
    expect(message).toContain('Исполнители: Иван, maria');
    expect(message).toContain(
      'Веб-версия: <a href="https://app.local/tasks/1"',
    );
  });

  test('buildDirectTaskKeyboard добавляет кнопки и дополняет reply_markup', () => {
    const { buildDirectTaskKeyboard } = loadBotModule();
    inlineKeyboardMock.mockImplementationOnce(() => ({}));

    const keyboard = buildDirectTaskKeyboard(
      'https://t.me/msg',
      'https://app.local/tasks/1',
    );

    expect(keyboard).toBeDefined();
    expect(inlineKeyboardMock).toHaveBeenCalledWith([
      [
        { text: 'Открыть в веб-версии', url: 'https://app.local/tasks/1' },
        { text: 'Открыть в чате', url: 'https://t.me/msg' },
      ],
    ]);
    expect(keyboard?.reply_markup?.inline_keyboard?.[0]).toHaveLength(2);
  });

  test('buildDirectTaskKeyboard без ссылок возвращает undefined', () => {
    const { buildDirectTaskKeyboard } = loadBotModule();
    const keyboard = buildDirectTaskKeyboard(undefined, null);
    expect(keyboard).toBeUndefined();
    expect(inlineKeyboardMock).not.toHaveBeenCalled();
  });

  test('startBot запускает бота и сбрасывает вебхук', async () => {
    const { startBot } = loadBotModule();
    await expect(startBot()).resolves.toBeUndefined();
    expect(deleteWebhookMock).toHaveBeenCalledWith({
      drop_pending_updates: true,
    });
    expect(launchMock).toHaveBeenCalledWith({ dropPendingUpdates: true });
  });

  test('startBot пробрасывает неретрайную ошибку', async () => {
    const { startBot } = loadBotModule();
    const failure = Object.assign(new Error('boom'), {
      response: { error_code: 400 },
    });
    launchMock.mockRejectedValueOnce(failure);
    await expect(startBot()).rejects.toBe(failure);
  });

  test('startBot продолжает перезапуск при множественных конфликтах getUpdates', async () => {
    jest.useFakeTimers();
    try {
      const { startBot } = loadBotModule();
      const conflictError = () =>
        Object.assign(new Error('conflict'), { response: { error_code: 409 } });

      launchMock
        .mockRejectedValueOnce(conflictError())
        .mockRejectedValueOnce(conflictError())
        .mockRejectedValueOnce(conflictError())
        .mockRejectedValueOnce(conflictError())
        .mockRejectedValueOnce(conflictError())
        .mockRejectedValueOnce(conflictError())
        .mockResolvedValueOnce(undefined);

      const startPromise = startBot();

      for (let attempt = 0; attempt < 6; attempt += 1) {
        await jest.advanceTimersByTimeAsync(1000);
        await Promise.resolve();
      }

      await startPromise;

      expect(launchMock).toHaveBeenCalledTimes(7);
      expect(deleteWebhookMock.mock.calls.length).toBeGreaterThanOrEqual(7);
    } finally {
      jest.useRealTimers();
    }
  }, 30000);

  test('startBot уважает retry_after от Telegram при ошибке 429', async () => {
    jest.useFakeTimers();
    try {
      const { startBot } = loadBotModule();
      const rateLimitError = () =>
        Object.assign(new Error('too many requests'), {
          response: { error_code: 429, parameters: { retry_after: 2 } },
          parameters: { retry_after: 2 },
        });

      launchMock
        .mockRejectedValueOnce(rateLimitError())
        .mockRejectedValueOnce(rateLimitError())
        .mockRejectedValueOnce(rateLimitError())
        .mockResolvedValueOnce(undefined);

      const startPromise = startBot();

      for (let attempt = 0; attempt < 3; attempt += 1) {
        await jest.advanceTimersByTimeAsync(2000);
        await Promise.resolve();
        await jest.advanceTimersByTimeAsync(1000);
        await Promise.resolve();
      }

      await startPromise;

      expect(launchMock).toHaveBeenCalledTimes(4);
      expect(deleteWebhookMock.mock.calls.length).toBeGreaterThanOrEqual(4);
    } finally {
      jest.useRealTimers();
    }
  }, 30000);
});
