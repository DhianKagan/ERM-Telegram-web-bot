// Назначение: автотесты восстановления клавиатуры Telegram при обновлении задачи
// Основные модули: jest, taskSync.controller, taskButtons

process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '555';
process.env.APP_URL = 'https://localhost';

const buildNotModifiedError = () => ({
  response: { error_code: 400, description: 'Bad Request: message is not modified' },
});

const mockEditMessageText = jest.fn();
const mockEditMessageReplyMarkup = jest.fn();
const mockDeleteMessage = jest.fn();

jest.mock('../src/db/queries', () => ({
  getUsersMap: jest.fn(async () => ({})),
}));

jest.mock('../src/utils/formatTask', () => ({
  __esModule: true,
  default: jest.fn(() => ({ text: 'Задача', inlineImages: undefined })),
}));

const mockUpdateOne = jest.fn(() => ({ exec: jest.fn().mockResolvedValue(undefined) }));

jest.mock('../src/db/model', () => ({
  Task: { updateOne: mockUpdateOne },
}));

jest.mock('../src/services/taskTypeSettings', () => ({
  resolveTaskTypeTopicId: jest.fn(async () => null),
}));

const mockDeleteAttachmentMessages = jest.fn();

jest.mock('../src/tasks/taskTelegramMedia', () => ({
  TaskTelegramMedia: jest.fn(() => ({
    collectSendableAttachments: jest.fn(() => ({
      previewImage: null,
      extras: [],
      collageCandidates: [],
    })),
    sendTaskMessageWithPreview: jest.fn(async () => ({
      messageId: 777,
      usedPreview: false,
      cache: new Map(),
      previewMessageIds: [],
      consumedAttachmentUrls: [],
    })),
    sendTaskAttachments: jest.fn(async () => []),
    deleteAttachmentMessages: mockDeleteAttachmentMessages,
  })),
}));

const botMock = {
  telegram: {
    editMessageText: mockEditMessageText,
    editMessageReplyMarkup: mockEditMessageReplyMarkup,
    deleteMessage: mockDeleteMessage,
    sendMessage: jest.fn(),
    sendPhoto: jest.fn(),
    sendMediaGroup: jest.fn(),
  },
};

describe('TaskSyncController — обновление inline-клавиатуры', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEditMessageText.mockReset();
    mockEditMessageReplyMarkup.mockReset();
    mockDeleteMessage.mockReset();
    mockEditMessageText.mockResolvedValue(undefined);
    mockEditMessageReplyMarkup.mockResolvedValue(undefined);
    mockDeleteMessage.mockResolvedValue(undefined);
  });

  it('повторно применяет inline-клавиатуру при ошибке «message is not modified»', async () => {
    mockEditMessageText.mockRejectedValueOnce(buildNotModifiedError());

    const { default: TaskSyncController } = require('../src/controllers/taskSync.controller');
    const controller = new TaskSyncController(botMock as never);

    const override = {
      _id: 'task-1',
      telegram_message_id: 111,
      status: 'Новая',
      title: 'Тестовая задача',
      attachments: [],
      assignees: [],
      controllers: [],
      created_by: 42,
    };

    await controller.syncAfterChange('task-1', override as never);

    expect(mockEditMessageText).toHaveBeenCalledWith(
      '555',
      111,
      undefined,
      expect.any(String),
      expect.objectContaining({ reply_markup: expect.any(Object) }),
    );
    expect(mockEditMessageReplyMarkup).toHaveBeenCalledWith(
      '555',
      111,
      undefined,
      expect.objectContaining({ inline_keyboard: expect.any(Array) }),
    );
    expect(mockDeleteMessage).not.toHaveBeenCalled();
  });
});

