// Назначение: проверка обновления истории статусов через Telegram-бота
// Основные модули: jest, bot, taskHistory.service
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

const getTaskHistoryMessageMock = jest.fn();
const updateTaskHistoryMessageIdMock = jest.fn();

jest.mock('../apps/api/src/tasks/taskHistory.service', () => ({
  getTaskHistoryMessage: (...args: unknown[]) => getTaskHistoryMessageMock(...args),
  updateTaskHistoryMessageId: (...args: unknown[]) =>
    updateTaskHistoryMessageIdMock(...args),
}));

jest.mock('../apps/api/src/services/scheduler', () => ({
  startScheduler: jest.fn(),
}));

jest.mock('../apps/api/src/services/keyRotation', () => ({
  startKeyRotation: jest.fn(),
}));

const taskStatusKeyboardMock = jest
  .fn()
  .mockImplementation((id: string, status?: string) => ({
    reply_markup: {
      inline_keyboard: [[{ callback_data: `status:${id}`, text: status ?? '' }]],
    },
  }));
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
    taskStatusKeyboardMock(...(args as [string, string | undefined])),
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

function createActionContext(data: string, userId: number | null = 42) {
  const ctx: Record<string, unknown> = {
    callbackQuery: { data },
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
});

test('редактирует существующее сообщение истории', async () => {
  updateTaskStatusMock.mockResolvedValue({ _id: 'task123' });
  getTaskHistoryMessageMock.mockResolvedValue({
    taskId: 'task123',
    messageId: 777,
    text: '*История изменений*\n• событие',
  });
  const ctx = createContext('task_done:task123') as Parameters<
    typeof processStatusAction
  >[0];

  await processStatusAction(ctx, 'Выполнена', 'Готово');

  expect(updateTaskStatusMock).toHaveBeenCalledWith('task123', 'Выполнена', 42);
  expect(getTaskHistoryMessageMock).toHaveBeenCalledWith('task123');
  expect(editMessageTextMock).toHaveBeenCalledWith(
    -1001234567890,
    777,
    undefined,
    '*История изменений*\n• событие',
    {
      parse_mode: 'MarkdownV2',
      link_preview_options: { is_disabled: true },
    },
  );
  expect(sendMessageMock).not.toHaveBeenCalled();
  expect(updateTaskHistoryMessageIdMock).toHaveBeenCalledWith('task123', 777);
});

test('создаёт новое сообщение истории и сохраняет идентификатор', async () => {
  updateTaskStatusMock.mockResolvedValue({ _id: 'task999' });
  getTaskHistoryMessageMock.mockResolvedValue({
    taskId: 'task999',
    messageId: null,
    topicId: 55,
    text: '*История изменений*\n• новое событие',
  });
  sendMessageMock.mockResolvedValue({ message_id: 31337 });
  const ctx = createContext('task_accept_confirm:task999') as Parameters<
    typeof processStatusAction
  >[0];

  await processStatusAction(ctx, 'В работе', 'Принято');

  expect(sendMessageMock).toHaveBeenCalledWith(
    -1001234567890,
    '*История изменений*\n• новое событие',
    {
      parse_mode: 'MarkdownV2',
      message_thread_id: 55,
      link_preview_options: { is_disabled: true },
    },
  );
  expect(updateTaskHistoryMessageIdMock).toHaveBeenCalledWith('task999', 31337);
  expect(editMessageTextMock).not.toHaveBeenCalled();
});

test('при завершении задачи отправляет только обновлённую историю', async () => {
  updateTaskStatusMock.mockResolvedValue({ _id: 'task777' });
  getTaskHistoryMessageMock.mockResolvedValue({
    taskId: 'task777',
    messageId: null,
    text: '*История изменений*\\n• завершение',
  });
  sendMessageMock.mockResolvedValue({ message_id: 451 });
  const ctx = createContext('task_done_confirm:task777') as Parameters<
    typeof processStatusAction
  >[0];

  await processStatusAction(ctx, 'Выполнена', 'Сделано');

  expect(sendMessageMock).toHaveBeenCalledTimes(1);
  expect(editMessageTextMock).not.toHaveBeenCalled();
  expect(updateTaskHistoryMessageIdMock).toHaveBeenCalledWith('task777', 451);
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

    expect(taskStatusKeyboardMock).toHaveBeenCalledWith('task321');
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

    expect(taskStatusKeyboardMock).toHaveBeenCalledWith('task555');
    expect(updateTaskStatusMock).toHaveBeenCalledWith('task555', 'Выполнена', 42);
    expect(ctx.answerCbQuery).toHaveBeenLastCalledWith('Сделано');
  });

  test('возвращает клавиатуру после отмены', async () => {
    const handler = findActionHandler('task_done_cancel');
    expect(handler).toBeDefined();
    const ctx = createActionContext('task_done_cancel:task900');
    const fn = handler as (ctx: Record<string, unknown>) => Promise<void>;

    await fn(ctx);

    expect(taskStatusKeyboardMock).toHaveBeenCalledWith('task900');
    expect(ctx.editMessageReplyMarkup).toHaveBeenCalledWith({
      inline_keyboard: [
        [expect.objectContaining({ callback_data: 'status:task900' })],
      ],
    });
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Отменено');
  });
});
