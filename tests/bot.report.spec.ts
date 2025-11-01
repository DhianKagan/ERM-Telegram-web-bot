// Назначение: интеграционный тест команды /report Telegram-бота
// Основные модули: bot, telegraf моки, reportGenerator

import type { ReportPayload } from '../apps/api/src/services/reportGenerator';

type Handler = (ctx: Record<string, unknown>) => Promise<void> | void;

const commandHandlers: Record<string, Handler> = {};
const keyboardMock = jest.fn(() => ({ resize: jest.fn(() => ({})) }));
const generatePdfMock = jest.fn<Promise<ReportPayload>, [Record<string, unknown>, unknown]>();
const generateExcelMock = jest.fn<Promise<ReportPayload>, [Record<string, unknown>, unknown]>();
const getUserMock = jest.fn();

jest.mock('../apps/api/src/config', () => ({
  botToken: 'test-token',
  getChatId: jest.fn(() => '-100123456'),
  chatId: '-100123456',
  appUrl: 'https://example.com',
}));

jest.mock('telegraf', () => {
  class TelegrafMock {
    telegram = {
      getChatMember: jest.fn().mockResolvedValue({ status: 'administrator' }),
      deleteWebhook: jest.fn(),
      sendMessage: jest.fn(),
      editMessageText: jest.fn(),
    };
    launch = jest.fn();
    start = jest.fn();
    command = jest.fn((trigger: string, handler: Handler) => {
      commandHandlers[trigger] = handler;
      return this;
    });
    hears = jest.fn();
    action = jest.fn();
    on = jest.fn();
    use = jest.fn();
    stop = jest.fn();
  }
  return {
    Telegraf: TelegrafMock,
    Markup: { keyboard: keyboardMock },
    Context: class {},
    __getCommandHandlers: () => commandHandlers,
  };
});

const serviceMock = {
  createUser: jest.fn(),
  getTask: jest.fn(),
  getUser: (...args: unknown[]) => getUserMock(...args),
  updateTask: jest.fn(),
  writeLog: jest.fn(),
};

jest.mock('../apps/api/src/services/service', () => serviceMock);

const fleetLeanMock = jest.fn().mockResolvedValue([]);
const fleetSortMock = jest.fn().mockReturnValue({ lean: fleetLeanMock });
const fleetFindMock = jest.fn().mockReturnValue({ sort: fleetSortMock, lean: fleetLeanMock });

jest.mock('../apps/api/src/db/models/fleet', () => ({
  FleetVehicle: { find: fleetFindMock },
}));

jest.mock('../apps/api/src/db/model', () => ({}));

jest.mock('../apps/api/src/utils/taskButtons', () => ({
  taskAcceptConfirmKeyboard: jest.fn(() => ({})),
  taskDoneConfirmKeyboard: jest.fn(() => ({})),
  taskCancelConfirmKeyboard: jest.fn(() => ({})),
  taskStatusInlineMarkup: jest.fn(() => ({})),
}));

jest.mock('../apps/api/src/utils/taskStatusIcons', () => ({
  TASK_STATUS_ICON_MAP: {},
}));

jest.mock('../apps/api/src/utils/messageLink', () => jest.fn(() => 'https://tg/link'));

jest.mock('../apps/api/src/utils/formatTask', () => jest.fn(() => 'formatted task'));

const queriesMock = {
  createTask: jest.fn(),
  getTasks: jest.fn().mockResolvedValue({ tasks: [], total: 0 }),
  updateTask: jest.fn(),
  updateTaskStatus: jest.fn(),
  getTask: jest.fn(),
  addTime: jest.fn(),
  bulkUpdate: jest.fn(),
  deleteTask: jest.fn(),
  summary: jest.fn(),
  chart: jest.fn(),
  tasksChart: jest.fn(),
  listMentionedTasks: jest.fn().mockResolvedValue([]),
  createUser: jest.fn(),
  generateUserCredentials: jest.fn(),
  getUser: jest.fn(),
  listUsers: jest.fn(),
  removeUser: jest.fn(),
  getUsersMap: jest.fn().mockResolvedValue({}),
  updateUser: jest.fn(),
  listRoles: jest.fn(),
  getRole: jest.fn(),
  updateRole: jest.fn(),
  writeLog: jest.fn(),
  listLogs: jest.fn(),
  searchTasks: jest.fn(),
  createTaskTemplate: jest.fn(),
  getTaskTemplate: jest.fn(),
  listTaskTemplates: jest.fn(),
  deleteTaskTemplate: jest.fn(),
  listRoutes: jest.fn(),
};

jest.mock('../apps/api/src/db/queries', () => queriesMock);

jest.mock('../apps/api/src/tasks/taskMessages', () => ({
  buildHistorySummaryLog: jest.fn(() => 'История'),
  getTaskIdentifier: jest.fn(() => 'ERM-1'),
}));

jest.mock('../apps/api/src/tasks/taskLinks', () => ({
  buildTaskAppLink: jest.fn(() => 'https://app.local/tasks/1'),
}));

jest.mock('shared', () => ({
  PROJECT_TIMEZONE: 'Europe/Kyiv',
  PROJECT_TIMEZONE_LABEL: 'Europe/Kyiv',
}));

jest.mock('../apps/api/src/controllers/taskSync.controller', () => ({
  __esModule: true,
  default: class {
    constructor() {}
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

jest.mock('../apps/api/src/utils/accessMask', () => ({ ACCESS_ADMIN: 8 }));

jest.mock('../apps/api/src/services/route', () => ({
  getRouteDistance: jest.fn(),
  clearRouteCache: jest.fn(),
}));

jest.mock('../apps/api/src/services/reportGenerator', () =>
  jest.fn().mockImplementation(() => ({
    generatePdf: generatePdfMock,
    generateExcel: generateExcelMock,
  })),
);

jest.mock('../apps/api/src/messages', () => ({
  __esModule: true,
  default: new Proxy(
    {},
    {
      get: (_target, prop: string) => `msg:${prop}`,
    },
  ),
}));

function loadBotModule() {
  jest.resetModules();
  process.env.NODE_ENV = 'test';
  process.env.BOT_TOKEN = 'test-token';
  let mod: typeof import('../apps/api/src/bot/bot');
  jest.isolateModules(() => {
    mod = require('../apps/api/src/bot/bot');
  });
  return mod!;
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(commandHandlers).forEach((key) => delete commandHandlers[key]);
  generatePdfMock.mockReset();
  generateExcelMock.mockReset();
  getUserMock.mockReset();
});

describe('команда /report', () => {
  test('отправляет отчёты администратору', async () => {
    const pdfPayload: ReportPayload = {
      data: Buffer.from('pdf'),
      contentType: 'application/pdf',
      fileName: 'tasks-report-test.pdf',
    };
    const excelPayload: ReportPayload = {
      data: Buffer.from('xlsx'),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: 'tasks-report-test.xlsx',
    };
    generatePdfMock.mockResolvedValue(pdfPayload);
    generateExcelMock.mockResolvedValue(excelPayload);
    getUserMock.mockResolvedValue({ telegram_id: 100, role: 'admin', access: 8 });

    loadBotModule();
    const { __getCommandHandlers } = jest.requireMock('telegraf') as {
      __getCommandHandlers: () => Record<string, Handler>;
    };
    const handler = __getCommandHandlers().report;
    expect(typeof handler).toBe('function');

    const ctx = {
      from: { id: 100 },
      reply: jest.fn().mockResolvedValue(undefined),
      replyWithDocument: jest.fn().mockResolvedValue(undefined),
    };

    await handler(ctx);

    expect(getUserMock).toHaveBeenCalledWith(100);
    expect(generatePdfMock).toHaveBeenCalledWith({}, {
      id: 100,
      role: 'admin',
      access: 8,
    });
    expect(generateExcelMock).toHaveBeenCalledTimes(1);
    expect(ctx.replyWithDocument).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ filename: pdfPayload.fileName }),
    );
    expect(ctx.replyWithDocument).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ filename: excelPayload.fileName }),
    );
    expect(ctx.reply).toHaveBeenCalledWith('msg:reportGenerationSuccess');
  });

  test('блокирует доступ без прав администратора', async () => {
    generatePdfMock.mockResolvedValue({
      data: Buffer.from('pdf'),
      contentType: 'application/pdf',
      fileName: 'tasks-report-test.pdf',
    });
    generateExcelMock.mockResolvedValue({
      data: Buffer.from('xlsx'),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: 'tasks-report-test.xlsx',
    });
    getUserMock.mockResolvedValue({ telegram_id: 100, role: 'user', access: 1 });

    loadBotModule();
    const { __getCommandHandlers } = jest.requireMock('telegraf') as {
      __getCommandHandlers: () => Record<string, Handler>;
    };
    const handler = __getCommandHandlers().report;

    const ctx = {
      from: { id: 100 },
      reply: jest.fn().mockResolvedValue(undefined),
      replyWithDocument: jest.fn().mockResolvedValue(undefined),
    };

    await handler(ctx);

    expect(ctx.reply).toHaveBeenCalledWith('msg:reportAdminsOnly');
    expect(ctx.replyWithDocument).not.toHaveBeenCalled();
    expect(generatePdfMock).not.toHaveBeenCalled();
    expect(generateExcelMock).not.toHaveBeenCalled();
  });
});
