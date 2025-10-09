// Назначение: проверка отсутствия обновления истории статусов в чате Telegram
// Основные модули: jest, bot
const editMessageTextMock = jest.fn();
const sendMessageMock = jest.fn();

process.env.NODE_ENV = 'test';
process.env.APP_URL = process.env.APP_URL || 'https://example.com';

jest.mock('../apps/api/src/config', () => ({
  botToken: 'test-token',
  chatId: -1001234567890,
  appUrl: 'https://example.com',
}));

jest.mock('telegraf', () => {
  const keyboard = jest.fn(() => ({ resize: jest.fn(() => ({})) }));
  const actionHandlers: Array<{
    trigger: string | RegExp;
    handler: (ctx: unknown) => Promise<void> | void;
  }> = [];
  class MockTelegraf {
    telegram = {
      editMessageText: editMessageTextMock,
      sendMessage: sendMessageMock,
      deleteWebhook: jest.fn(),
    };
    launch = jest.fn();
    start = jest.fn();
    command = jest.fn();
    hears = jest.fn();
    action = jest.fn((trigger: string | RegExp, handler: (ctx: unknown) => Promise<void> | void) => {
      actionHandlers.push({ trigger, handler });
      return this;
    });
    on = jest.fn();
    use = jest.fn();
    stop = jest.fn();
  }
  return {
    Telegraf: MockTelegraf,
    Markup: { keyboard },
    Context: class {},
    __getActionHandlers: () => actionHandlers,
  };
});

const updateTaskStatusMock = jest.fn();
const getTaskMock = jest.fn();

jest.mock('../apps/api/src/services/service', () => ({
  updateTaskStatus: (...args: unknown[]) => updateTaskStatusMock(...args),
  createUser: jest.fn(),
  getUser: jest.fn(),
  getTask: (...args: unknown[]) => getTaskMock(...args),
}));

jest.mock('../apps/api/src/services/scheduler', () => ({
  startScheduler: jest.fn(),
}));

jest.mock('../apps/api/src/services/keyRotation', () => ({
  startKeyRotation: jest.fn(),
}));

const taskStatusKeyboardMock = jest
  .fn()
  .mockImplementation(
    (id: string, status?: string, options?: { kind?: string }) => ({
      reply_markup: {
        inline_keyboard: [[{ callback_data: `status:${id}`, text: status ?? '' }]],
      },
      options,
    }),
  );
const taskAcceptConfirmKeyboardMock = jest
  .fn()
  .mockImplementation((id: string) => ({
    reply_markup: { inline_keyboard: [[{ callback_data: `accept:${id}` }]] },
  }));
const taskDoneConfirmKeyboardMock = jest
  .fn()
  .mockImplementation((id: string) => ({
    reply_markup: { inline_keyboard: [[{ callback_data: `done:${id}` }]] },
  }));
const taskCancelConfirmKeyboardMock = jest
  .fn()
  .mockImplementation((id: string) => ({
    reply_markup: { inline_keyboard: [[{ callback_data: `cancel:${id}` }]] },
  }));

jest.mock('../apps/api/src/utils/taskButtons', () => ({
  __esModule: true,
  default: (...args: unknown[]) =>
    taskStatusKeyboardMock(
      ...(args as [string, string | undefined, Record<string, unknown> | undefined]),
    ),
  taskAcceptConfirmKeyboard: (
    ...args: unknown[]
  ) => taskAcceptConfirmKeyboardMock(...(args as [string])),
  taskDoneConfirmKeyboard: (
    ...args: unknown[]
  ) => taskDoneConfirmKeyboardMock(...(args as [string])),
  taskCancelConfirmKeyboard: (
    ...args: unknown[]
  ) => taskCancelConfirmKeyboardMock(...(args as [string])),
}));

jest.mock('../apps/api/src/messages', () => ({
  taskAccepted: 'Принято',
  taskCompleted: 'Сделано',
  menuPrompt: 'Меню',
  accessOnlyGroup: 'Только группа',
  accessError: 'Ошибка',
  welcomeBack: 'Привет',
  registrationSuccess: 'Успешно',
  ermLink: 'https://erm',
  noVehicles: 'Нет транспорта',
  vehiclesError: 'Ошибка транспорта',
  taskStatusPrompt: 'Подтвердите',
  taskStatusInvalidId: 'Плохой ID',
  taskStatusUnknownUser: 'Неизвестный пользователь',
  taskNotFound: 'Нет задачи',
  taskPermissionError: 'Ошибка прав',
  taskAssignmentRequired: 'Не ваш таск',
  taskStatusCanceled: 'Отменено',
  taskStatusUpdateError: 'Ошибка обновления',
  taskCanceled: 'Отменено',
  taskCompletedLock: 'Только отмена',
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { processStatusAction } = require('../apps/api/src/bot/bot');

function createContext(data: string) {
  return {
    callbackQuery: { data },
    from: { id: 42 },
    answerCbQuery: jest.fn(),
    editMessageReplyMarkup: jest.fn(),
    editMessageText: jest.fn(),
  } as unknown;
}

type ActionHandler = {
  trigger: string | RegExp;
  handler: (ctx: unknown) => Promise<void> | void;
};

function getActionHandlers(): ActionHandler[] {
  const telegraf = require('telegraf') as {
    __getActionHandlers(): ActionHandler[];
  };
  return telegraf.__getActionHandlers();
}

function findActionHandler(part: string):
  | ((ctx: unknown) => Promise<void> | void)
  | undefined {
  const actions = getActionHandlers();
  const regexEntry = actions.find(
    ({ trigger }) => trigger instanceof RegExp && trigger.source.includes(part),
  );
  if (regexEntry) {
    return regexEntry.handler;
  }
  const stringEntry = actions.find(
    ({ trigger }) => typeof trigger === 'string' && trigger === part,
  );
  return stringEntry?.handler;
}

function createActionContext(
  data: string,
  userId: number | null = 42,
  replyMarkup?: Record<string, unknown>,
) {
  const callbackQuery: Record<string, unknown> = { data };
  if (replyMarkup) {
    callbackQuery.message = { reply_markup: replyMarkup };
  }
  const ctx: Record<string, unknown> = {
    callbackQuery,
    answerCbQuery: jest.fn(),
    editMessageReplyMarkup: jest.fn(),
  };
  if (userId !== null) {
    ctx.from = { id: userId };
  }
  return ctx;
}

beforeEach(() => {
  jest.clearAllMocks();
  taskStatusKeyboardMock.mockReset();
  taskStatusKeyboardMock.mockImplementation((id: string, status?: string) => ({
    reply_markup: {
      inline_keyboard: [[{ callback_data: `status:${id}`, text: status ?? '' }]],
    },
  }));
  taskAcceptConfirmKeyboardMock.mockReset();
  taskAcceptConfirmKeyboardMock.mockImplementation((id: string) => ({
    reply_markup: { inline_keyboard: [[{ callback_data: `accept:${id}` }]] },
  }));
  taskDoneConfirmKeyboardMock.mockReset();
  taskDoneConfirmKeyboardMock.mockImplementation((id: string) => ({
    reply_markup: { inline_keyboard: [[{ callback_data: `done:${id}` }]] },
  }));
  taskCancelConfirmKeyboardMock.mockReset();
  taskCancelConfirmKeyboardMock.mockImplementation((id: string) => ({
    reply_markup: { inline_keyboard: [[{ callback_data: `cancel:${id}` }]] },
  }));
});

test('не обращается к истории в чате при обновлении статуса', async () => {
  getTaskMock.mockResolvedValue({
    _id: 'task123',
    assigned_user_id: 42,
    assignees: [],
  });
  updateTaskStatusMock.mockResolvedValue({ _id: 'task123' });
  const ctx = createContext('task_done:task123') as Parameters<
    typeof processStatusAction
  >[0];

  await processStatusAction(ctx, 'Выполнена', 'Готово');

  expect(updateTaskStatusMock).toHaveBeenCalledWith('task123', 'Выполнена', 42);
  expect(editMessageTextMock).not.toHaveBeenCalled();
  const historyCalls = sendMessageMock.mock.calls.filter(([, text]) =>
    typeof text === 'string' && text.includes('История изменений'),
  );
  expect(historyCalls).toHaveLength(0);
});

test('не редактирует клавиатуру при повторном подтверждении', async () => {
  const handler = findActionHandler('task_accept_confirm');
  expect(handler).toBeDefined();
  const markup = {
    inline_keyboard: [
      [
        { callback_data: 'task_accept_prompt:task123', text: 'В работу' },
        { callback_data: 'task_done_prompt:task123', text: 'Выполнена' },
      ],
    ],
  };
  taskStatusKeyboardMock
    .mockReturnValueOnce({ reply_markup: markup })
    .mockReturnValueOnce({ reply_markup: markup });
  getTaskMock.mockResolvedValue({
    _id: 'task123',
    assigned_user_id: 42,
    assignees: [],
  });
  updateTaskStatusMock.mockResolvedValue({ _id: 'task123' });
  const ctx = createActionContext(
    'task_accept_confirm:task123',
    42,
    markup,
  );
  (ctx as { chat?: { type: string } }).chat = { type: 'private' };
  (ctx as { editMessageText?: jest.Mock }).editMessageText = jest
    .fn()
    .mockResolvedValue(undefined);
  const fn = handler as (ctx: Record<string, unknown>) => Promise<void>;

  await fn(ctx);

  expect(ctx.editMessageReplyMarkup).toHaveBeenCalledWith(undefined);
  expect(updateTaskStatusMock).toHaveBeenCalledWith('task123', 'В работе', 42);
});

describe('обработка завершения задачи', () => {
  test('показывает клавиатуру подтверждения', async () => {
    const handler = findActionHandler('task_done_prompt');
    expect(handler).toBeDefined();
    const ctx = createActionContext('task_done_prompt:task123');

    const fn = handler as (ctx: Record<string, unknown>) => Promise<void>;
    await fn(ctx);

    expect(taskDoneConfirmKeyboardMock).toHaveBeenCalledWith('task123');
    expect(ctx.editMessageReplyMarkup).toHaveBeenCalledWith({
      inline_keyboard: [[{ callback_data: 'done:task123' }]],
    });
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Подтвердите');
  });

  test('отказывает незадействованному пользователю', async () => {
    const handler = findActionHandler('task_done_confirm');
    expect(handler).toBeDefined();
    getTaskMock.mockResolvedValue({
      _id: 'task321',
      assigned_user_id: 99,
      assignees: [],
    });
    const ctx = createActionContext('task_done_confirm:task321');
    const fn = handler as (ctx: Record<string, unknown>) => Promise<void>;

    await fn(ctx);

    expect(taskStatusKeyboardMock).toHaveBeenCalledWith(
      'task321',
      undefined,
      expect.objectContaining({ kind: 'task' }),
    );
    expect(ctx.editMessageReplyMarkup).toHaveBeenCalledWith({
      inline_keyboard: [
        [expect.objectContaining({ callback_data: 'status:task321' })],
      ],
    });
    expect(ctx.answerCbQuery).toHaveBeenLastCalledWith('Не ваш таск', {
      show_alert: true,
    });
    expect(updateTaskStatusMock).not.toHaveBeenCalled();
  });

  test('подтверждает завершение назначенному пользователю', async () => {
    const handler = findActionHandler('task_done_confirm');
    expect(handler).toBeDefined();
    getTaskMock.mockResolvedValue({
      _id: 'task555',
      assigned_user_id: 42,
      assignees: [],
    });
    updateTaskStatusMock.mockResolvedValue({ _id: 'task555' });
    const ctx = createActionContext('task_done_confirm:task555');
    const fn = handler as (ctx: Record<string, unknown>) => Promise<void>;

    await fn(ctx);

    expect(taskStatusKeyboardMock).toHaveBeenCalledWith(
      'task555',
      'Выполнена',
      expect.objectContaining({ kind: 'task' }),
    );
    expect(updateTaskStatusMock).toHaveBeenCalledWith('task555', 'Выполнена', 42);
    expect(ctx.answerCbQuery).toHaveBeenLastCalledWith('Сделано');
  });

  test('возвращает клавиатуру после отмены', async () => {
    const handler = findActionHandler('task_done_cancel');
    expect(handler).toBeDefined();
    const ctx = createActionContext('task_done_cancel:task900');
    const fn = handler as (ctx: Record<string, unknown>) => Promise<void>;

    await fn(ctx);

    expect(taskStatusKeyboardMock).toHaveBeenCalledWith(
      'task900',
      undefined,
      expect.objectContaining({ kind: 'task' }),
    );
    expect(ctx.editMessageReplyMarkup).toHaveBeenCalledWith({
      inline_keyboard: [
        [expect.objectContaining({ callback_data: 'status:task900' })],
      ],
    });
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Отменено');
  });
});
