// Назначение: проверка обновления истории статусов через Telegram-бота
// Основные модули: jest, bot, taskHistory.service
const editMessageTextMock = jest.fn();
const sendMessageMock = jest.fn();

process.env.NODE_ENV = 'test';

jest.mock('../apps/api/src/config', () => ({
  botToken: 'test-token',
  chatId: -1001234567890,
}));

jest.mock('telegraf', () => {
  const keyboard = jest.fn(() => ({ resize: jest.fn(() => ({})) }));
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
    action = jest.fn();
    on = jest.fn();
    use = jest.fn();
    stop = jest.fn();
  }
  return {
    Telegraf: MockTelegraf,
    Markup: { keyboard },
    Context: class {},
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
const updateTaskStatusMessageIdMock = jest.fn();

jest.mock('../apps/api/src/tasks/taskHistory.service', () => ({
  getTaskHistoryMessage: (...args: unknown[]) => getTaskHistoryMessageMock(...args),
  updateTaskStatusMessageId: (...args: unknown[]) =>
    updateTaskStatusMessageIdMock(...args),
}));

jest.mock('../apps/api/src/services/scheduler', () => ({
  startScheduler: jest.fn(),
}));

jest.mock('../apps/api/src/services/keyRotation', () => ({
  startKeyRotation: jest.fn(),
}));

jest.mock('../apps/api/src/utils/taskButtons', () => ({
  __esModule: true,
  default: jest.fn(() => ({ reply_markup: {} })),
  taskAcceptConfirmKeyboard: jest.fn(() => ({ reply_markup: {} })),
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
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { processStatusAction } = require('../apps/api/src/bot/bot');

function createContext(data: string) {
  return {
    callbackQuery: { data },
    from: { id: 42 },
    answerCbQuery: jest.fn(),
  } as unknown;
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
    { parse_mode: 'MarkdownV2' },
  );
  expect(sendMessageMock).not.toHaveBeenCalled();
  expect(updateTaskStatusMessageIdMock).not.toHaveBeenCalled();
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
    { parse_mode: 'MarkdownV2', message_thread_id: 55 },
  );
  expect(updateTaskStatusMessageIdMock).toHaveBeenCalledWith('task999', 31337);
  expect(editMessageTextMock).not.toHaveBeenCalled();
});
