// Назначение: основной файл Telegram-бота
// Основные модули: dotenv, telegraf, service, scheduler, config, taskHistory.service
import 'dotenv/config';
import { botToken, getChatId, chatId as staticChatId } from '../config';
import { Telegraf, Markup, Context } from 'telegraf';
import type {
  InlineKeyboardMarkup,
  InlineKeyboardButton,
} from 'telegraf/typings/core/types/typegram';
import messages from '../messages';
import {
  createUser,
  getTask,
  getUser,
  updateTask as updateTaskRecord,
  writeLog,
} from '../services/service';
import '../db/model';
import type {
  TaskDocument,
  Comment,
  UserDocument,
  Attachment,
} from '../db/model';
import { FleetVehicle, type FleetVehicleAttrs } from '../db/models/fleet';
import {
  taskAcceptConfirmKeyboard,
  taskDoneConfirmKeyboard,
  taskCancelConfirmKeyboard,
  taskStatusInlineMarkup,
} from '../utils/taskButtons';
import { TASK_STATUS_ICON_MAP } from '../utils/taskStatusIcons';
import buildChatMessageLink from '../utils/messageLink';
import formatTask from '../utils/formatTask';
import { createTask, getUsersMap } from '../db/queries';
import {
  buildHistorySummaryLog,
  getTaskIdentifier,
} from '../tasks/taskMessages';
import { buildTaskAppLink } from '../tasks/taskLinks';
import { PROJECT_TIMEZONE, PROJECT_TIMEZONE_LABEL } from 'shared';
import type { Task as SharedTask } from 'shared';
import TaskSyncController from '../controllers/taskSync.controller';
import { resolveTaskAlbumLink } from '../utils/taskAlbumLink';
import { buildCommentHtml } from '../tasks/taskComments';
import { buildAttachmentsFromCommentHtml } from '../utils/attachments';
import { ACCESS_ADMIN } from '../utils/accessMask';
import { collectAssigneeIds, normalizeUserId } from '../utils/assigneeIds';
import ReportGeneratorService from '../services/reportGenerator';
import TasksService from '../tasks/tasks.service';
import queries from '../db/queries';

if (process.env.NODE_ENV !== 'production') {
  console.log('BOT_TOKEN загружен');
}

export const bot: Telegraf<Context> = new Telegraf(botToken!);

const taskSyncController = new TaskSyncController(bot);
const reportGenerator = new ReportGeneratorService(new TasksService(queries));
const REQUEST_TYPE_NAME = 'Заявка';

const resolveChatId = (): string | undefined =>
  typeof getChatId === 'function' ? getChatId() : staticChatId;

type CancelRequestStage = 'awaitingReason' | 'awaitingConfirm';

type CancelRequestSession = {
  taskId: string;
  actorId: number;
  identifier: string;
  reason?: string;
  stage: CancelRequestStage;
};

class CancellationRequestError extends Error {
  constructor(
    public code:
      | 'not_found'
      | 'not_executor'
      | 'creator_missing'
      | 'unsupported',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'CancellationRequestError';
  }
}

const cancelRequestSessions = new Map<number, CancelRequestSession>();
const commentSessions = new Map<
  number,
  { taskId: string; identifier: string }
>();
const HISTORY_ALERT_LIMIT = 190;
const CANCEL_REASON_MIN_LENGTH = 50;
const CANCEL_REASON_MAX_LENGTH = 2000;

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection in bot:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in bot:', err);
  process.exit(1);
});

function normalizeInlineKeyboard(
  markup: InlineKeyboardMarkup | undefined,
): ReadonlyArray<ReadonlyArray<Record<string, unknown>>> | undefined {
  if (!markup || typeof markup !== 'object') {
    return markup === undefined ? undefined : [];
  }
  const inline = Array.isArray(markup.inline_keyboard)
    ? markup.inline_keyboard
    : null;
  if (!inline) {
    return undefined;
  }
  return inline.map((row) =>
    row
      .filter((button): button is InlineKeyboardButton =>
        Boolean(button && typeof button === 'object'),
      )
      .map((button) => normalizeButton(button)),
  );
}

function normalizeButton(
  button: InlineKeyboardButton,
): Record<string, unknown> {
  const plain = button as unknown as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(plain)
      .filter(([, value]) => typeof value !== 'undefined')
      .sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0)),
  );
}

function areInlineKeyboardsEqual(
  nextMarkup: InlineKeyboardMarkup | undefined,
  currentMarkup: InlineKeyboardMarkup | undefined,
): boolean {
  if (!nextMarkup && !currentMarkup) {
    return true;
  }
  if (!nextMarkup || !currentMarkup) {
    return false;
  }
  const next = normalizeInlineKeyboard(nextMarkup);
  const current = normalizeInlineKeyboard(currentMarkup);
  if (!next || !current) {
    return false;
  }
  return JSON.stringify(next) === JSON.stringify(current);
}

function isMessageNotModifiedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const record = error as Record<string, unknown>;
  const responseRaw = record.response;
  const response =
    responseRaw && typeof responseRaw === 'object'
      ? (responseRaw as { error_code?: number; description?: unknown })
      : null;
  const descriptionSource =
    typeof response?.description === 'string'
      ? response.description
      : typeof record.description === 'string'
        ? record.description
        : '';
  const description = descriptionSource.toLowerCase();
  return (
    response?.error_code === 400 &&
    description.includes('message is not modified')
  );
}

function isMessageMissingOnEditError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const record = error as Record<string, unknown> & {
    response?: { error_code?: number; description?: unknown };
    description?: unknown;
    error_code?: unknown;
  };
  const errorCode =
    typeof record.response?.error_code === 'number'
      ? record.response.error_code
      : typeof record.error_code === 'number'
        ? record.error_code
        : null;
  if (errorCode !== 400) {
    return false;
  }
  const descriptionSource =
    typeof record.response?.description === 'string'
      ? record.response.description
      : typeof record.description === 'string'
        ? record.description
        : '';
  return descriptionSource.toLowerCase().includes('message to edit not found');
}

function buildHistoryAlert(summary: string): string {
  const normalizedLines = summary
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (!normalizedLines.length) {
    return '';
  }
  const selected: string[] = [];
  for (let index = normalizedLines.length - 1; index >= 0; index -= 1) {
    const current = normalizedLines[index];
    if (!current) {
      continue;
    }
    if (!selected.length) {
      selected.unshift(current);
      continue;
    }
    const candidate = [current, ...selected].join('\n');
    if (candidate.length > HISTORY_ALERT_LIMIT) {
      break;
    }
    selected.unshift(current);
  }
  let text = selected.join('\n');
  if (!text) {
    return '';
  }
  if (text.length > HISTORY_ALERT_LIMIT) {
    text = `${text.slice(0, HISTORY_ALERT_LIMIT - 1)}…`;
  }
  return text;
}

const htmlEscapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const htmlEscapePattern = /[&<>"']/g;

const escapeHtml = (value: string): string =>
  String(value).replace(
    htmlEscapePattern,
    (char) => htmlEscapeMap[char] ?? char,
  );

const normalizeReasonText = (reason: string): string => {
  const normalized = reason.replace(/\r\n/g, '\n').trim();
  if (normalized.length <= CANCEL_REASON_MAX_LENGTH) {
    return normalized;
  }
  return normalized.slice(0, CANCEL_REASON_MAX_LENGTH);
};

const formatCancellationDescription = (
  identifier: string,
  reason: string,
  status?: string,
): string => {
  const parts: string[] = [];
  const trimmedIdentifier = identifier.trim();
  if (trimmedIdentifier) {
    parts.push(
      `<p><strong>Задача:</strong> ${escapeHtml(trimmedIdentifier)}</p>`,
    );
  }
  const normalizedReason = reason.replace(/\r?\n/g, '\n');
  const reasonSegments = normalizedReason
    .split('\n')
    .map((segment) => escapeHtml(segment.trim()))
    .filter((segment) => segment.length > 0);
  const reasonHtml = reasonSegments.length
    ? reasonSegments.join('<br />')
    : escapeHtml(normalizedReason.trim());
  parts.push(
    `<p><strong>Причина удаления:</strong><br />${reasonHtml || '—'}</p>`,
  );
  const statusTrimmed = typeof status === 'string' ? status.trim() : '';
  if (statusTrimmed) {
    parts.push(
      `<p><strong>Текущий статус:</strong> ${escapeHtml(statusTrimmed)}</p>`,
    );
  }
  return parts.join('');
};

type CancelRequestContext = {
  plain: TaskPresentation;
  creatorId: number;
  identifier: string;
  docId: string;
};

const toPlainTask = (
  task: TaskDocument | (TaskDocument & Record<string, unknown>),
): TaskPresentation =>
  typeof (task as { toObject?: () => unknown }).toObject === 'function'
    ? ((task as { toObject(): unknown }).toObject() as TaskPresentation)
    : (task as TaskPresentation);

async function loadCancelRequestContext(
  taskId: string,
  actorId: number,
): Promise<CancelRequestContext> {
  const task = await getTask(taskId);
  if (!task) {
    throw new CancellationRequestError('not_found');
  }
  const plain = toPlainTask(task);
  const kind = detectTaskKind(plain);
  if (kind !== 'task') {
    throw new CancellationRequestError('unsupported');
  }
  if (!isTaskExecutor(plain, actorId)) {
    throw new CancellationRequestError('not_executor');
  }
  const creatorId = Number(plain.created_by);
  if (!Number.isFinite(creatorId) || creatorId === 0) {
    throw new CancellationRequestError('creator_missing');
  }
  const identifier =
    getTaskIdentifier(plain as Parameters<typeof getTaskIdentifier>[0]) ||
    taskId;
  const docId =
    typeof plain._id === 'object' &&
    plain._id !== null &&
    'toString' in plain._id
      ? (plain._id as { toString(): string }).toString()
      : String((plain as { _id?: unknown })._id ?? taskId);
  return { plain, creatorId, identifier, docId };
}

async function createCancellationRequestFromTask(
  taskId: string,
  actorId: number,
  reason: string,
): Promise<{ requestId: string; identifier: string }> {
  const context = await loadCancelRequestContext(taskId, actorId);
  const { plain, creatorId, identifier, docId } = context;
  const normalizedReason = normalizeReasonText(reason);
  const description = formatCancellationDescription(
    identifier,
    normalizedReason,
    typeof plain.status === 'string' ? plain.status : undefined,
  );
  const payload: Partial<TaskDocument> = {
    title: `Запрос на отмену задачи ${identifier}`,
    task_description: description,
    kind: 'request',
    task_type: REQUEST_TYPE_NAME,
    status: 'Новая',
    created_by: actorId,
    custom: {
      cancelSource: {
        taskId: docId,
        identifier,
        requestedBy: actorId,
        requestedAt: new Date().toISOString(),
      },
      cancelReason: normalizedReason,
    },
  };
  if (Number.isFinite(creatorId) && creatorId !== 0) {
    payload.assigned_user_id = creatorId;
    payload.assignees = [creatorId];
  }
  const created = await createTask(payload, actorId);
  const requestId =
    typeof created._id === 'object' &&
    created._id !== null &&
    'toString' in created._id
      ? (created._id as { toString(): string }).toString()
      : String(created._id ?? '');
  if (requestId) {
    try {
      await taskSyncController.onWebTaskUpdate(requestId, created);
    } catch (error) {
      console.error(
        'Не удалось синхронизировать заявку на удаление задачи',
        error,
      );
    }
  }
  try {
    await writeLog(
      `Создана заявка ${requestId} пользователем ${actorId}/telegram`,
    );
  } catch (error) {
    console.error('Не удалось записать лог создания заявки', error);
  }
  return { requestId, identifier };
}

async function updateMessageReplyMarkup(
  ctx: Context,
  markup: InlineKeyboardMarkup | undefined,
): Promise<void> {
  const existingMarkup = extractInlineKeyboardMarkup(ctx);
  if (areInlineKeyboardsEqual(markup, existingMarkup)) {
    return;
  }
  try {
    await ctx.editMessageReplyMarkup(markup);
  } catch (error) {
    if (isMessageNotModifiedError(error)) {
      return;
    }
    if (isMessageMissingOnEditError(error)) {
      const callback = ctx.callbackQuery;
      if (callback && typeof callback === 'object' && 'data' in callback) {
        const rawData =
          typeof callback.data === 'string' ? callback.data : null;
        if (rawData) {
          const [, taskId] = rawData.split(':');
          if (taskId) {
            try {
              await taskSyncController.syncAfterChange(taskId);
            } catch (syncError) {
              console.error(
                'Не удалось пересоздать сообщение задачи после отсутствующей клавиатуры',
                syncError,
              );
            }
          }
        }
      }
      return;
    }
    throw error;
  }
}

function extractInlineKeyboardMarkup(
  ctx: Context,
): InlineKeyboardMarkup | undefined {
  const rawMessage = ctx.callbackQuery?.message;
  if (!rawMessage || typeof rawMessage !== 'object') {
    return undefined;
  }
  const candidate = rawMessage as { reply_markup?: unknown };
  const markup = candidate.reply_markup;
  if (!markup || typeof markup !== 'object') {
    return undefined;
  }
  const maybeKeyboard = markup as { inline_keyboard?: unknown };
  return Array.isArray(maybeKeyboard.inline_keyboard)
    ? (markup as InlineKeyboardMarkup)
    : undefined;
}

async function showMainMenu(ctx: Context): Promise<void> {
  await ctx.reply(
    messages.menuPrompt,
    Markup.keyboard([['Регистрация в ERM'], ['ERM веб-клиент']]).resize(),
  );
}

async function checkAndRegister(ctx: Context): Promise<void> {
  try {
    const chatId = resolveChatId();
    if (!chatId) {
      await ctx.reply(messages.accessError);
      return;
    }
    const member = await bot.telegram.getChatMember(chatId, ctx.from!.id);
    if (!['creator', 'administrator', 'member'].includes(member.status)) {
      await ctx.reply(messages.accessOnlyGroup);
      return;
    }
  } catch {
    await ctx.reply(messages.accessError);
    return;
  }
  const user = await getUser(ctx.from!.id);
  if (user) {
    await ctx.reply(messages.welcomeBack);
  } else {
    await createUser(ctx.from!.id, ctx.from?.username || '');
    await ctx.reply(messages.registrationSuccess);
  }
}

bot.start(async (ctx) => {
  await checkAndRegister(ctx);
  await showMainMenu(ctx);
});

bot.command('register', checkAndRegister);
bot.hears(['Регистрация', 'Регистрация в ERM'], checkAndRegister);
bot.hears(['ERM', 'ERM веб-клиент'], async (ctx) => {
  await ctx.reply(messages.ermLink);
});

function formatVehicleLine(vehicle: FleetVehicleAttrs): string {
  const parts: string[] = [`Регистрация: ${vehicle.registrationNumber}`];
  parts.push(`Тип транспорта: ${vehicle.transportType}`);
  parts.push(
    `Одометр: старт ${vehicle.odometerInitial} км, текущее ${vehicle.odometerCurrent} км`,
  );
  parts.push(`Пробег: ${vehicle.mileageTotal} км`);
  parts.push(`Топливо: ${vehicle.fuelType}`);
  parts.push(`Заправлено: ${vehicle.fuelRefilled}`);
  parts.push(`Средний расход: ${vehicle.fuelAverageConsumption} л/км`);
  parts.push(`Израсходовано: ${vehicle.fuelSpentTotal} л`);
  if (vehicle.currentTasks.length) {
    parts.push(`Текущие задачи: ${vehicle.currentTasks.join(', ')}`);
  }
  return `• ${vehicle.name}\n${parts.join('\n')}`;
}

async function sendFleetVehicles(ctx: Context): Promise<void> {
  try {
    const vehicles = await FleetVehicle.find().sort({ name: 1 }).lean();
    if (!vehicles.length) {
      await ctx.reply(messages.noVehicles);
      return;
    }
    const lines = vehicles.map((vehicle: FleetVehicleAttrs) =>
      formatVehicleLine({
        name: vehicle.name,
        registrationNumber: vehicle.registrationNumber,
        odometerInitial: vehicle.odometerInitial,
        odometerCurrent: vehicle.odometerCurrent,
        mileageTotal: vehicle.mileageTotal,
        transportType: vehicle.transportType,
        fuelType: vehicle.fuelType,
        fuelRefilled: vehicle.fuelRefilled,
        fuelAverageConsumption: vehicle.fuelAverageConsumption,
        fuelSpentTotal: vehicle.fuelSpentTotal,
        currentTasks: vehicle.currentTasks,
      }),
    );
    await ctx.reply(lines.join('\n\n'));
  } catch (error) {
    console.error('Не удалось отправить список транспорта:', error);
    await ctx.reply(messages.vehiclesError);
  }
}

async function handleReportCommand(ctx: Context): Promise<void> {
  const fromId = ctx.from?.id;
  if (typeof fromId !== 'number' || !Number.isFinite(fromId)) {
    await ctx.reply(messages.reportGenerationError);
    return;
  }
  const user = await getUser(fromId);
  if (!hasAdminPrivileges(user)) {
    await ctx.reply(messages.reportAdminsOnly);
    return;
  }
  const reportUser = user
    ? {
        id:
          typeof user.telegram_id === 'number'
            ? user.telegram_id
            : (user.id ?? undefined),
        role: user.role,
        access: user.access,
      }
    : undefined;
  try {
    const [pdfReport, excelReport] = await Promise.all([
      reportGenerator.generatePdf({}, reportUser),
      reportGenerator.generateExcel({}, reportUser),
    ]);
    await ctx.replyWithDocument({
      source: pdfReport.data,
      filename: pdfReport.fileName,
    });
    await ctx.replyWithDocument({
      source: excelReport.data,
      filename: excelReport.fileName,
    });
    await ctx.reply(messages.reportGenerationSuccess);
  } catch (error) {
    console.error('Не удалось сформировать отчёты задач', error);
    await ctx.reply(messages.reportGenerationError);
  }
}

bot.command('vehicles', sendFleetVehicles);
bot.hears('Транспорт', sendFleetVehicles);
bot.command('report', handleReportCommand);

const MAX_RETRIES = 5;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const extractTelegramErrorCode = (error: unknown): number | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const record = error as {
    error_code?: unknown;
    response?: { error_code?: unknown };
  };
  const directCode =
    typeof record.error_code === 'number' ? record.error_code : null;
  if (directCode !== null) {
    return directCode;
  }
  const responseCode =
    typeof record.response?.error_code === 'number'
      ? record.response.error_code
      : null;
  return responseCode;
};

const extractRetryAfterSeconds = (error: unknown): number | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const record = error as {
    parameters?: { retry_after?: unknown };
    response?: { parameters?: { retry_after?: unknown } };
  };
  const candidates = [record.parameters, record.response?.parameters];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }
    const retryAfterRaw = (candidate as { retry_after?: unknown }).retry_after;
    const retryAfter = Number(retryAfterRaw);
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      return Math.ceil(retryAfter);
    }
  }
  return null;
};

const waitForRetryAfter = async (
  error: unknown,
  context: string,
): Promise<number | null> => {
  if (extractTelegramErrorCode(error) !== 429) {
    return null;
  }
  const retryAfterSeconds = extractRetryAfterSeconds(error);
  if (!retryAfterSeconds) {
    return null;
  }
  console.warn(`${context}; повторная попытка через ${retryAfterSeconds} с`);
  await sleep(retryAfterSeconds * 1000);
  return retryAfterSeconds;
};

const CLOSE_RETRY_GRACE_MS = 2000;

let closeThrottleUntil = 0;

const resetLongPollingSession = async (): Promise<void> => {
  try {
    bot.stop('telegram:retry');
  } catch (stopError) {
    console.warn(
      'Не удалось локально остановить экземпляр бота перед повторным запуском',
      stopError,
    );
  }
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.warn(
      'Webhook удалён, обновления сброшены перед повторным запуском',
    );
  } catch (deleteError) {
    console.error(
      'Не удалось удалить webhook перед повторным запуском long polling',
      deleteError,
    );
  }
  const now = Date.now();
  if (now < closeThrottleUntil) {
    const remainingSeconds = Math.ceil((closeThrottleUntil - now) / 1000);
    console.warn(
      `Пропускаем завершение long polling методом close, осталось ожидать ${remainingSeconds} с`,
    );
    return;
  }
  try {
    await bot.telegram.callApi('close', {});
    closeThrottleUntil = 0;
    console.warn(
      'Текущая long polling сессия Telegram завершена методом close',
    );
  } catch (closeError) {
    const retryAfterSeconds = extractRetryAfterSeconds(closeError);
    if (retryAfterSeconds) {
      closeThrottleUntil =
        Date.now() + retryAfterSeconds * 1000 + CLOSE_RETRY_GRACE_MS;
    }
    console.error(
      'Не удалось завершить предыдущую long polling сессию методом close',
      closeError,
    );
    await waitForRetryAfter(closeError, 'Получена ошибка 429 от метода close');
  }
};

const getCallbackData = (callback: Context['callbackQuery']): string | null => {
  if (!callback) return null;
  if ('data' in callback && typeof callback.data === 'string')
    return callback.data;
  return null;
};

const getTaskIdFromCallback = (data: string | null): string | null => {
  if (!data) return null;
  const [, taskId] = data.split(':');
  return taskId || null;
};

const directMessageDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: PROJECT_TIMEZONE,
});

const statusDisplayMap: Record<SharedTask['status'], string> = {
  Новая: `${TASK_STATUS_ICON_MAP['Новая']} Новая`,
  'В работе': `${TASK_STATUS_ICON_MAP['В работе']} В работе`,
  Выполнена: `${TASK_STATUS_ICON_MAP['Выполнена']} Выполнена`,
  Отменена: `${TASK_STATUS_ICON_MAP['Отменена']} Отменена`,
};

export { buildTaskAppLink } from '../tasks/taskLinks';

const htmlEscape = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatDateTimeLabel = (value?: string | Date | null): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = directMessageDateFormatter.format(date).replace(', ', ' ');
  return `${formatted} (${PROJECT_TIMEZONE_LABEL})`;
};

const toNumericId = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const collectTaskUserIds = (task: Record<string, unknown>): number[] => {
  const ids = new Set<number>();
  const singleKeys: (keyof typeof task)[] = [
    'assigned_user_id',
    'controller_user_id',
    'created_by',
    'transport_driver_id',
  ];
  singleKeys.forEach((key) => {
    const value = task[key as keyof typeof task];
    const id = normalizeUserId(value);
    if (id !== null) {
      ids.add(id);
    }
  });
  const arrayKeys: (keyof typeof task)[] = ['assignees', 'controllers'];
  arrayKeys.forEach((key) => {
    const raw = task[key as keyof typeof task];
    collectAssigneeIds(raw).forEach((id) => ids.add(id));
  });
  return Array.from(ids);
};

const hasAdminPrivileges = (user: UserDocument | null): boolean => {
  if (!user) {
    return false;
  }
  if (user.role === 'admin') {
    return true;
  }
  const mask = typeof user.access === 'number' ? user.access : 0;
  return (mask & ACCESS_ADMIN) === ACCESS_ADMIN;
};

export type TaskUserProfile = {
  name: string;
  username: string;
  isBot: boolean;
};

const buildUsersIndex = async (
  ids: number[],
): Promise<Record<number, TaskUserProfile>> => {
  if (!ids.length) {
    return {};
  }
  try {
    const raw = await getUsersMap(ids);
    const entries = Object.entries(raw ?? {})
      .map(([key, value]) => {
        const numericId = Number(key);
        if (!Number.isFinite(numericId)) {
          return null;
        }
        const name =
          typeof value?.name === 'string' && value.name.trim()
            ? value.name.trim()
            : '';
        const username =
          typeof value?.username === 'string' && value.username.trim()
            ? value.username.trim()
            : '';
        const isBot = value?.is_bot === true;
        return [numericId, { name, username, isBot }] as const;
      })
      .filter(
        (entry): entry is readonly [number, TaskUserProfile] => entry !== null,
      );
    return Object.fromEntries(entries) as Record<number, TaskUserProfile>;
  } catch (error) {
    console.error('Не удалось получить данные пользователей задачи', error);
    return {};
  }
};

type TaskLike = TaskDocument | Record<string, unknown> | null | undefined;

const detectTaskKind = (task: TaskLike): 'task' | 'request' => {
  if (!task || typeof task !== 'object') {
    return 'task';
  }
  const source = task as Record<string, unknown>;
  const rawKind =
    typeof source.kind === 'string' ? source.kind.trim().toLowerCase() : '';
  if (rawKind === 'request') {
    return 'request';
  }
  const typeValue =
    typeof source.task_type === 'string' ? source.task_type.trim() : '';
  return typeValue === REQUEST_TYPE_NAME ? 'request' : 'task';
};

const isTaskExecutor = (task: TaskLike, userId: number): boolean => {
  if (!task || typeof task !== 'object' || !Number.isFinite(userId)) {
    return false;
  }
  const source = task as Record<string, unknown>;
  const assignedNumeric = normalizeUserId(source.assigned_user_id);
  if (assignedNumeric !== null && assignedNumeric === userId) {
    return true;
  }
  const assignees = collectAssigneeIds(source.assignees);
  return assignees.includes(userId);
};

const isTaskCreator = (task: TaskLike, userId: number): boolean => {
  if (!task || typeof task !== 'object' || !Number.isFinite(userId)) {
    return false;
  }
  const source = task as Record<string, unknown>;
  const creatorNumeric = Number(source.created_by);
  return Number.isFinite(creatorNumeric) && creatorNumeric === userId;
};

const isTaskRelatedUser = (task: TaskLike, userId: number): boolean => {
  if (!task || typeof task !== 'object' || !Number.isFinite(userId)) {
    return false;
  }
  return collectTaskUserIds(task as Record<string, unknown>).includes(userId);
};

const formatCoordinates = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { lat?: unknown; lng?: unknown };
  const lat = Number(candidate.lat);
  const lng = Number(candidate.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};

export const buildDirectTaskMessage = (
  task: Record<string, unknown> & { status?: SharedTask['status'] },
  link: string | null,
  users: Record<number, TaskUserProfile>,
  appLink: string | null = null,
  options?: { note?: string | null },
): string => {
  const lines: string[] = [];
  const note = typeof options?.note === 'string' ? options.note.trim() : '';
  if (note) {
    lines.push(`<i>${htmlEscape(note)}</i>`);
  }
  const identifier = getTaskIdentifier(task);
  const title = typeof task.title === 'string' ? task.title.trim() : '';
  const headerContent = (() => {
    if (link) {
      const label = identifier ? htmlEscape(identifier) : 'по ссылке';
      return `<a href="${link}">${label}</a>`;
    }
    return identifier
      ? `<b>${htmlEscape(identifier)}</b>`
      : '<b>без номера</b>';
  })();
  lines.push(`Задача ${headerContent}`);
  if (title) {
    lines.push(`Название: <b>${htmlEscape(title)}</b>`);
  }
  const status = task.status && statusDisplayMap[task.status];
  if (status) {
    lines.push(`Статус: <b>${htmlEscape(status)}</b>`);
  }
  const dueLabel = formatDateTimeLabel(task.due_date as string | Date | null);
  if (dueLabel) {
    lines.push(`Срок: <code>${htmlEscape(dueLabel)}</code>`);
  }
  const startLocation =
    typeof task.start_location === 'string' ? task.start_location.trim() : '';
  const endLocation =
    typeof task.end_location === 'string' ? task.end_location.trim() : '';
  const startLink =
    typeof task.start_location_link === 'string'
      ? task.start_location_link.trim()
      : '';
  const endLink =
    typeof task.end_location_link === 'string'
      ? task.end_location_link.trim()
      : '';
  if (startLocation) {
    const coords = formatCoordinates(task.startCoordinates);
    const label = startLink
      ? `<a href="${startLink}">${htmlEscape(startLocation)}</a>`
      : htmlEscape(startLocation);
    lines.push(
      `Старт: ${label}${coords ? ` (<code>${htmlEscape(coords)}</code>)` : ''}`,
    );
  }
  if (endLocation) {
    const coords = formatCoordinates(task.finishCoordinates);
    const label = endLink
      ? `<a href="${endLink}">${htmlEscape(endLocation)}</a>`
      : htmlEscape(endLocation);
    lines.push(
      `Финиш: ${label}${coords ? ` (<code>${htmlEscape(coords)}</code>)` : ''}`,
    );
  }
  const distance = Number(task.route_distance_km);
  if (Number.isFinite(distance) && distance > 0) {
    lines.push(`Логистика: <b>${htmlEscape(`${distance} км`)}</b>`);
  }
  const assignees = Array.isArray(task.assignees)
    ? task.assignees
        .map((item) => {
          const id = toNumericId(item);
          if (id === null) return null;
          const profile = users[id];
          const display = profile?.name || profile?.username || `#${id}`;
          return htmlEscape(display);
        })
        .filter((value): value is string => Boolean(value))
    : [];
  if (assignees.length) {
    lines.push(`Исполнители: ${assignees.join(', ')}`);
  }
  if (appLink) {
    lines.push(
      `Веб-версия: <a href="${htmlEscape(appLink)}">Открыть задачу</a>`,
    );
  }
  return lines.join('\n');
};

export const buildDirectTaskKeyboard = (
  link: string | null | undefined,
  appLink: string | null | undefined = null,
): ReturnType<typeof Markup.inlineKeyboard> | undefined => {
  const row: InlineKeyboardButton[] = [];
  if (appLink) {
    row.push({ text: 'Открыть в веб-версии', url: appLink });
  }
  if (link) {
    row.push({ text: 'Открыть в чате', url: link });
  }
  if (!row.length) {
    return undefined;
  }
  if (typeof Markup.inlineKeyboard !== 'function') {
    console.warn(
      'Пропущено построение inline-клавиатуры: отсутствует поддержка',
    );
    return undefined;
  }
  const keyboard = Markup.inlineKeyboard([row]) as ReturnType<
    typeof Markup.inlineKeyboard
  > & { reply_markup?: InlineKeyboardMarkup };
  if (!keyboard.reply_markup) {
    keyboard.reply_markup = {
      inline_keyboard: [row],
    };
  }
  return keyboard;
};

type TaskPresentation = SharedTask &
  Record<string, unknown> & { telegram_topic_id?: number };

const loadTaskContext = async (
  taskId: string,
  override?: TaskPresentation,
): Promise<{
  plain: TaskPresentation | null;
  users: Record<number, TaskUserProfile>;
}> => {
  if (override) {
    const ids = collectTaskUserIds(override);
    const users = await buildUsersIndex(ids);
    return { plain: override, users };
  }
  try {
    const taskDoc = await getTask(taskId);
    if (!taskDoc) {
      return { plain: null, users: {} };
    }
    const plainRaw =
      typeof taskDoc.toObject === 'function'
        ? (taskDoc.toObject() as unknown)
        : (taskDoc as unknown);
    const plain = plainRaw as TaskPresentation;
    const ids = collectTaskUserIds(plain);
    const users = await buildUsersIndex(ids);
    return { plain, users };
  } catch (error) {
    console.error('Не удалось загрузить данные задачи для Telegram', error);
    return { plain: null, users: {} };
  }
};

const syncTaskPresentation = async (
  taskId: string,
  override?: TaskPresentation,
): Promise<{
  plain: TaskPresentation | null;
  users: Record<number, TaskUserProfile>;
}> => {
  const context = await loadTaskContext(taskId, override);
  const { plain, users } = context;
  if (!plain) {
    return context;
  }
  const chatId = resolveChatId();
  if (!chatId) {
    return context;
  }
  try {
    const messageId = toNumericId(plain.telegram_message_id);
    const topicId = toNumericId(plain.telegram_topic_id);
    const status =
      typeof plain.status === 'string'
        ? (plain.status as SharedTask['status'])
        : undefined;
    if (messageId !== null) {
      const formatted = formatTask(plain as SharedTask, users);
      const kind = detectTaskKind(plain);
      const albumLink = resolveTaskAlbumLink(plain, {
        fallbackChatId: chatId,
        fallbackTopicId: topicId,
      });
      const replyMarkup = taskStatusInlineMarkup(
        taskId,
        status,
        { kind },
        albumLink ? { albumLink } : undefined,
      );
      const options: Parameters<typeof bot.telegram.editMessageText>[4] = {
        parse_mode: 'MarkdownV2',
        link_preview_options: { is_disabled: true },
        reply_markup: replyMarkup,
      };
      try {
        await bot.telegram.editMessageText(
          chatId,
          messageId,
          undefined,
          formatted.text,
          options,
        );
      } catch (error) {
        if (isMessageNotModifiedError(error)) {
          // Сообщение не изменилось — обновление не требуется
        } else if (isMessageMissingOnEditError(error)) {
          console.info(
            'Сообщение задачи отсутствует в Telegram, выполняем пересинхронизацию',
            { taskId, messageId },
          );
          try {
            await taskSyncController.syncAfterChange(taskId);
          } catch (syncError) {
            console.error(
              'Не удалось пересоздать сообщение задачи после ошибки editMessageText',
              syncError,
            );
          }
          try {
            return await loadTaskContext(taskId);
          } catch (reloadError) {
            console.error(
              'Не удалось обновить контекст задачи после пересинхронизации',
              reloadError,
            );
          }
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    console.error('Не удалось обновить представление задачи в Telegram', error);
  }
  return context;
};

async function ensureUserCanUpdateTask(
  ctx: Context,
  taskId: string,
  userId: number,
  logContext: string,
  options: { targetStatus?: 'В работе' | 'Выполнена' | 'Отменена' } = {},
): Promise<boolean> {
  try {
    const task = await getTask(taskId);
    if (!task) {
      await ctx.answerCbQuery(messages.taskNotFound, { show_alert: true });
      return false;
    }
    const assignedUserId = normalizeUserId(
      (task as { assigned_user_id?: unknown }).assigned_user_id,
    );
    const assignees = collectAssigneeIds(
      (task as { assignees?: unknown }).assignees,
    );
    const hasAssignments = assignedUserId !== null || assignees.length > 0;
    const isAllowed =
      (assignedUserId !== null && assignedUserId === userId) ||
      assignees.includes(userId);
    const kind = detectTaskKind(task);
    const creatorId = Number(task.created_by);
    const isCreator = Number.isFinite(creatorId) && creatorId === userId;
    const allowCreatorCancellation =
      options.targetStatus === 'Отменена' && kind === 'request' && isCreator;
    if (hasAssignments && !isAllowed && !allowCreatorCancellation) {
      await ctx.answerCbQuery(messages.taskAssignmentRequired, {
        show_alert: true,
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error(logContext, error);
    await ctx.answerCbQuery(messages.taskPermissionError, { show_alert: true });
    return false;
  }
}

type TaskSnapshot = {
  plain: TaskPresentation | null;
  users: Record<number, TaskUserProfile>;
};

async function refreshTaskKeyboard(
  ctx: Context,
  taskId: string,
  snapshot?: TaskSnapshot,
): Promise<TaskSnapshot> {
  let context: TaskSnapshot = snapshot ?? { plain: null, users: {} };
  if (!snapshot) {
    try {
      const taskDoc = await getTask(taskId);
      if (taskDoc) {
        const plainSource =
          typeof (taskDoc as { toObject?: () => unknown }).toObject ===
          'function'
            ? (taskDoc as { toObject(): unknown }).toObject()
            : (taskDoc as unknown);
        context = { plain: plainSource as TaskPresentation, users: {} };
      }
    } catch (error) {
      console.error(
        'Не удалось получить задачу для обновления клавиатуры',
        error,
      );
    }
  }
  const plain = context.plain;
  const status =
    typeof plain?.status === 'string'
      ? (plain.status as SharedTask['status'])
      : undefined;
  const messageId = toNumericId(plain?.telegram_message_id ?? null);
  const topicId = toNumericId(plain?.telegram_topic_id ?? null);
  const chatId = resolveChatId();
  const link = buildChatMessageLink(
    chatId,
    messageId ?? undefined,
    topicId ?? undefined,
  );
  if (ctx.chat?.type === 'private') {
    const appLink = plain ? buildTaskAppLink(plain) : null;
    const keyboard = buildDirectTaskKeyboard(link, appLink ?? undefined);
    await updateMessageReplyMarkup(ctx, keyboard?.reply_markup ?? undefined);
  } else {
    const kind = detectTaskKind(plain ?? undefined);
    const albumLink = plain
      ? resolveTaskAlbumLink(plain, {
          fallbackChatId: chatId,
          fallbackTopicId: topicId,
        })
      : null;
    const replyMarkup = taskStatusInlineMarkup(
      taskId,
      status,
      { kind },
      albumLink ? { albumLink } : undefined,
    );
    await updateMessageReplyMarkup(ctx, replyMarkup);
  }
  return context;
}

async function denyCancellation(
  ctx: Context,
  taskId: string,
  message?: string,
): Promise<void> {
  try {
    await refreshTaskKeyboard(ctx, taskId);
  } catch (error) {
    console.error('Не удалось обновить клавиатуру после запрета отмены', error);
  }
  await ctx.answerCbQuery(message ?? messages.taskCancelForbidden, {
    show_alert: true,
  });
}

async function processStatusAction(
  ctx: Context,
  status: 'В работе' | 'Выполнена' | 'Отменена',
  responseMessage: string,
) {
  const data = getCallbackData(ctx.callbackQuery);
  const taskId = data?.split(':')[1];
  if (!taskId) {
    await ctx.answerCbQuery(messages.taskStatusInvalidId, {
      show_alert: true,
    });
    return;
  }
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.answerCbQuery(messages.taskStatusUnknownUser, {
      show_alert: true,
    });
    return;
  }
  let snapshot: TaskSnapshot = { plain: null, users: {} };
  try {
    const current = await getTask(taskId);
    if (current) {
      const plainSource =
        typeof (current as { toObject?: () => unknown }).toObject === 'function'
          ? (current as { toObject(): unknown }).toObject()
          : (current as unknown);
      snapshot = { plain: plainSource as TaskPresentation, users: {} };
    }
  } catch (error) {
    console.error(
      'Не удалось получить задачу перед обновлением статуса',
      error,
    );
  }
  if (status === 'Отменена') {
    const snapshotTask = snapshot.plain;
    if (!snapshotTask) {
      await denyCancellation(ctx, taskId);
      return;
    }
    const kind = detectTaskKind(snapshotTask);
    const creator = isTaskCreator(snapshotTask, userId);
    if (kind === 'request') {
      if (!creator && !isTaskExecutor(snapshotTask, userId)) {
        await denyCancellation(ctx, taskId, messages.requestCancelExecutorOnly);
        return;
      }
    } else if (!creator) {
      await denyCancellation(ctx, taskId);
      return;
    }
  }
  try {
    const currentStatus = snapshot.plain?.status;
    if (
      typeof currentStatus === 'string' &&
      currentStatus === 'Выполнена' &&
      status !== 'Выполнена'
    ) {
      try {
        await refreshTaskKeyboard(ctx, taskId, snapshot);
      } catch (error) {
        console.error('Не удалось восстановить клавиатуру статуса', error);
      }
      await ctx.answerCbQuery(messages.taskCompletedLock, {
        show_alert: true,
      });
      return;
    }
    let docId = taskId;
    const updatedPlain = await taskSyncController.onTelegramAction(
      taskId,
      status,
      userId,
    );
    if (!updatedPlain) {
      await ctx.answerCbQuery(messages.taskNotFound, { show_alert: true });
      return;
    }
    docId =
      typeof updatedPlain._id === 'object' &&
      updatedPlain._id !== null &&
      'toString' in updatedPlain._id
        ? (updatedPlain._id as { toString(): string }).toString()
        : String((updatedPlain as { _id?: unknown })._id ?? taskId);
    const override = updatedPlain as unknown as TaskPresentation;
    const presentation = await syncTaskPresentation(
      docId,
      override ?? undefined,
    );
    const appliedStatus = ((presentation.plain?.status as
      | SharedTask['status']
      | undefined) ?? status) as SharedTask['status'];
    const plainForView = {
      ...(override ?? {}),
      ...(presentation.plain ?? {}),
      status: appliedStatus,
    } as TaskPresentation;
    const messageId = toNumericId(plainForView?.telegram_message_id ?? null);
    const topicId = toNumericId(plainForView?.telegram_topic_id ?? null);
    const chatId = resolveChatId();
    const link = buildChatMessageLink(
      chatId,
      messageId ?? undefined,
      topicId ?? undefined,
    );
    const appLink = plainForView ? buildTaskAppLink(plainForView) : null;
    if (ctx.chat?.type === 'private') {
      const keyboard = buildDirectTaskKeyboard(link, appLink ?? undefined);
      const inlineMarkup = keyboard?.reply_markup ?? undefined;
      if (inlineMarkup) {
        await updateMessageReplyMarkup(ctx, undefined);
      }
      const dmText = buildDirectTaskMessage(
        plainForView,
        link,
        presentation.users,
        appLink,
      );
      try {
        await ctx.editMessageText(dmText, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          ...(inlineMarkup ? { reply_markup: inlineMarkup } : {}),
        });
        if (!inlineMarkup) {
          await updateMessageReplyMarkup(ctx, undefined);
        }
      } catch (error) {
        console.warn('Не удалось обновить личное уведомление задачи', error);
        try {
          await updateMessageReplyMarkup(ctx, inlineMarkup);
        } catch (updateError) {
          console.warn(
            'Не удалось обновить клавиатуру уведомления',
            updateError,
          );
        }
      }
    } else {
      try {
        await refreshTaskKeyboard(ctx, taskId, {
          plain: plainForView,
          users: presentation.users,
        });
      } catch (error) {
        console.warn('Не удалось обновить клавиатуру статуса', error);
      }
    }
    await ctx.answerCbQuery(responseMessage);
  } catch (error) {
    console.error('Не удалось обновить статус задачи', error);
    await ctx.answerCbQuery(messages.taskStatusUpdateError, {
      show_alert: true,
    });
  }
}

bot.action('task_accept', async (ctx) => {
  await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});

bot.action(/^task_history:.+$/, async (ctx) => {
  const data = getCallbackData(ctx.callbackQuery);
  const taskId = getTaskIdFromCallback(data);
  if (!taskId) {
    await ctx.answerCbQuery(messages.taskStatusInvalidId, {
      show_alert: true,
    });
    return;
  }
  try {
    const task = await getTask(taskId);
    if (!task) {
      await ctx.answerCbQuery(messages.taskNotFound, { show_alert: true });
      return;
    }
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.answerCbQuery(messages.taskStatusUnknownUser, {
        show_alert: true,
      });
      return;
    }
    const plain = toPlainTask(task);
    if (!isTaskRelatedUser(plain, userId)) {
      console.warn(
        'Попытка просмотра истории задачи без назначения',
        taskId,
        userId,
      );
      await ctx.answerCbQuery(messages.taskAssignmentRequired, {
        show_alert: true,
      });
      return;
    }
    const summary = await buildHistorySummaryLog(
      plain as Parameters<typeof buildHistorySummaryLog>[0],
    );
    if (!summary) {
      await ctx.answerCbQuery(messages.taskHistoryEmpty, { show_alert: true });
      return;
    }
    const alertText = buildHistoryAlert(summary);
    if (!alertText) {
      await ctx.answerCbQuery(messages.taskHistoryEmpty, {
        show_alert: true,
      });
      return;
    }
    await ctx.answerCbQuery(alertText, { show_alert: true });
  } catch (error) {
    console.error('Не удалось показать историю задачи в Telegram', error);
    await ctx.answerCbQuery(messages.taskHistoryPopupError, {
      show_alert: true,
    });
  }
});

bot.action(/^task_comment_prompt:.+$/, async (ctx) => {
  const data = getCallbackData(ctx.callbackQuery);
  const taskId = getTaskIdFromCallback(data);
  if (!taskId) {
    await ctx.answerCbQuery(messages.taskStatusInvalidId, {
      show_alert: true,
    });
    return;
  }
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.answerCbQuery(messages.taskStatusUnknownUser, {
      show_alert: true,
    });
    return;
  }
  try {
    const context = await loadTaskContext(taskId);
    const plain = context.plain;
    if (!plain) {
      await ctx.answerCbQuery(messages.taskNotFound, {
        show_alert: true,
      });
      return;
    }
    const userRecord = await getUser(userId);
    const allowed =
      hasAdminPrivileges(userRecord) ||
      isTaskCreator(plain, userId) ||
      isTaskExecutor(plain, userId);
    if (!allowed) {
      await ctx.answerCbQuery(messages.taskPermissionError, {
        show_alert: true,
      });
      return;
    }
    const identifier = getTaskIdentifier(plain) ?? `#${taskId}`;
    commentSessions.set(userId, { taskId, identifier });
    try {
      await bot.telegram.sendMessage(
        userId,
        `${messages.enterComment}. Задача: ${identifier}`,
      );
    } catch (error) {
      commentSessions.delete(userId);
      console.error('Не удалось отправить запрос комментария', error);
      await ctx.answerCbQuery(messages.commentStartError, { show_alert: true });
      return;
    }
    await ctx.answerCbQuery(messages.commentPromptSent);
  } catch (error) {
    console.error('Не удалось подготовить ввод комментария', error);
    await ctx.answerCbQuery(messages.commentStartError, { show_alert: true });
  }
});

bot.action('task_accept_prompt', async (ctx) => {
  await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});

bot.action(/^task_accept_prompt:.+$/, async (ctx) => {
  const data = getCallbackData(ctx.callbackQuery);
  const taskId = getTaskIdFromCallback(data);
  if (!taskId) {
    await ctx.answerCbQuery(messages.taskStatusInvalidId, {
      show_alert: true,
    });
    return;
  }
  const keyboard = taskAcceptConfirmKeyboard(taskId);
  await updateMessageReplyMarkup(ctx, keyboard.reply_markup ?? undefined);
  await ctx.answerCbQuery(messages.taskStatusPrompt);
});

bot.action('task_accept_confirm', async (ctx) => {
  await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});

bot.action(/^task_accept_confirm:.+$/, async (ctx) => {
  const data = getCallbackData(ctx.callbackQuery);
  const taskId = getTaskIdFromCallback(data);
  if (!taskId) {
    await ctx.answerCbQuery(messages.taskStatusInvalidId, {
      show_alert: true,
    });
    return;
  }
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.answerCbQuery(messages.taskStatusUnknownUser, {
      show_alert: true,
    });
    try {
      await refreshTaskKeyboard(ctx, taskId);
    } catch (error) {
      console.error(
        'Не удалось обновить клавиатуру после неопределённого пользователя',
        error,
      );
    }
    return;
  }

  const canUpdate = await ensureUserCanUpdateTask(
    ctx,
    taskId,
    userId,
    'Не удалось получить задачу перед подтверждением',
  );
  if (!canUpdate) {
    try {
      await refreshTaskKeyboard(ctx, taskId);
    } catch (error) {
      console.error(
        'Не удалось восстановить клавиатуру после отмены подтверждения',
        error,
      );
    }
    return;
  }

  await processStatusAction(ctx, 'В работе', messages.taskAccepted);
});

bot.action('task_accept_cancel', async (ctx) => {
  await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});

bot.action(/^task_accept_cancel:.+$/, async (ctx) => {
  const data = getCallbackData(ctx.callbackQuery);
  const taskId = getTaskIdFromCallback(data);
  if (!taskId) {
    await ctx.answerCbQuery(messages.taskStatusInvalidId, {
      show_alert: true,
    });
    return;
  }
  try {
    await refreshTaskKeyboard(ctx, taskId);
  } catch (error) {
    console.error(
      'Не удалось восстановить клавиатуру после отмены подтверждения',
      error,
    );
  }
  await ctx.answerCbQuery(messages.taskStatusCanceled);
});

bot.action('task_done', async (ctx) => {
  await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});

bot.action('task_done_prompt', async (ctx) => {
  await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});

bot.action(/^task_done_prompt:.+$/, async (ctx) => {
  const data = getCallbackData(ctx.callbackQuery);
  const taskId = getTaskIdFromCallback(data);
  if (!taskId) {
    await ctx.answerCbQuery(messages.taskStatusInvalidId, {
      show_alert: true,
    });
    return;
  }
  const keyboard = taskDoneConfirmKeyboard(taskId);
  await updateMessageReplyMarkup(ctx, keyboard.reply_markup ?? undefined);
  await ctx.answerCbQuery(messages.taskStatusPrompt);
});

bot.action('task_done_confirm', async (ctx) => {
  await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});

bot.action(/^task_done_confirm:.+$/, async (ctx) => {
  const data = getCallbackData(ctx.callbackQuery);
  const taskId = getTaskIdFromCallback(data);
  if (!taskId) {
    await ctx.answerCbQuery(messages.taskStatusInvalidId, {
      show_alert: true,
    });
    return;
  }
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.answerCbQuery(messages.taskStatusUnknownUser, {
      show_alert: true,
    });
    try {
      await refreshTaskKeyboard(ctx, taskId);
    } catch (error) {
      console.error(
        'Не удалось обновить клавиатуру после неопределённого пользователя',
        error,
      );
    }
    return;
  }

  const canUpdate = await ensureUserCanUpdateTask(
    ctx,
    taskId,
    userId,
    'Не удалось получить задачу перед завершением',
  );
  if (!canUpdate) {
    try {
      await refreshTaskKeyboard(ctx, taskId);
    } catch (error) {
      console.error(
        'Не удалось восстановить клавиатуру после отказа завершения',
        error,
      );
    }
    return;
  }

  await processStatusAction(ctx, 'Выполнена', messages.taskCompleted);
});

bot.action('task_done_cancel', async (ctx) => {
  await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});

bot.action(/^task_done_cancel:.+$/, async (ctx) => {
  const data = getCallbackData(ctx.callbackQuery);
  const taskId = getTaskIdFromCallback(data);
  if (!taskId) {
    await ctx.answerCbQuery(messages.taskStatusInvalidId, {
      show_alert: true,
    });
    return;
  }
  try {
    await refreshTaskKeyboard(ctx, taskId);
  } catch (error) {
    console.error(
      'Не удалось восстановить клавиатуру после отмены завершения',
      error,
    );
  }
  await ctx.answerCbQuery(messages.taskStatusCanceled);
});

bot.action(/^task_done:.+$/, async (ctx) => {
  await processStatusAction(ctx, 'Выполнена', messages.taskCompleted);
});

bot.action('task_cancel', async (ctx) => {
  await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});

bot.action('task_cancel_prompt', async (ctx) => {
  await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});

bot.action('task_cancel_request_prompt', async (ctx) => {
  await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});

bot.action(/^task_cancel_request_prompt:.+$/, async (ctx) => {
  const data = getCallbackData(ctx.callbackQuery);
  const taskId = getTaskIdFromCallback(data);
  if (!taskId) {
    await ctx.answerCbQuery(messages.taskStatusInvalidId, {
      show_alert: true,
    });
    return;
  }
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.answerCbQuery(messages.taskStatusUnknownUser, {
      show_alert: true,
    });
    return;
  }
  try {
    const context = await loadCancelRequestContext(taskId, userId);
    cancelRequestSessions.set(userId, {
      taskId,
      actorId: userId,
      identifier: context.identifier,
      stage: 'awaitingReason',
    });
    const promptText = `Введите причину отмены для задачи ${context.identifier}. Текст должен содержать не менее ${CANCEL_REASON_MIN_LENGTH} символов.`;
    const cancelRows: InlineKeyboardButton[][] = [
      [Markup.button.callback('Отмена', `cancel_request_abort:${taskId}`)],
    ];
    const keyboard = Markup.inlineKeyboard(cancelRows) as ReturnType<
      typeof Markup.inlineKeyboard
    > & { reply_markup?: InlineKeyboardMarkup };
    if (!keyboard.reply_markup) {
      keyboard.reply_markup = { inline_keyboard: cancelRows };
    }
    try {
      await bot.telegram.sendMessage(userId, promptText, {
        reply_markup: keyboard.reply_markup,
      });
    } catch (error) {
      cancelRequestSessions.delete(userId);
      console.error('Не удалось отправить запрос причины отмены', error);
      await ctx.answerCbQuery(messages.cancelRequestStartError, {
        show_alert: true,
      });
      return;
    }
    await ctx.answerCbQuery(messages.cancelRequestPrompt);
  } catch (error) {
    let response: string = messages.cancelRequestFailed;
    if (error instanceof CancellationRequestError) {
      switch (error.code) {
        case 'not_found':
          response = messages.taskNotFound;
          break;
        case 'not_executor':
          response = messages.taskAssignmentRequired;
          break;
        case 'creator_missing':
          response = messages.cancelRequestCreatorMissing;
          break;
        case 'unsupported':
          response = messages.cancelRequestUnavailable;
          break;
        default:
          response = messages.cancelRequestFailed;
      }
    } else {
      console.error('Не удалось подготовить заявку на удаление', error);
    }
    await ctx.answerCbQuery(response, { show_alert: true });
  }
});

bot.action(/^task_cancel_prompt:.+$/, async (ctx) => {
  const data = getCallbackData(ctx.callbackQuery);
  const taskId = getTaskIdFromCallback(data);
  if (!taskId) {
    await ctx.answerCbQuery(messages.taskStatusInvalidId, {
      show_alert: true,
    });
    return;
  }
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.answerCbQuery(messages.taskStatusUnknownUser, {
      show_alert: true,
    });
    return;
  }
  const context = await loadTaskContext(taskId);
  const plain = context.plain;
  if (!plain) {
    await denyCancellation(ctx, taskId);
    return;
  }
  const kind = detectTaskKind(plain);
  if (kind !== 'request') {
    await denyCancellation(ctx, taskId);
    return;
  }
  const isCreator = isTaskCreator(plain, userId);
  if (!isCreator && !isTaskExecutor(plain, userId)) {
    await denyCancellation(ctx, taskId, messages.requestCancelExecutorOnly);
    return;
  }
  const keyboard = taskCancelConfirmKeyboard(taskId);
  await updateMessageReplyMarkup(ctx, keyboard.reply_markup ?? undefined);
  await ctx.answerCbQuery(messages.taskStatusPrompt);
});

bot.action('task_cancel_confirm', async (ctx) => {
  await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});

bot.action(/^task_cancel_confirm:.+$/, async (ctx) => {
  const data = getCallbackData(ctx.callbackQuery);
  const taskId = getTaskIdFromCallback(data);
  if (!taskId) {
    await ctx.answerCbQuery(messages.taskStatusInvalidId, {
      show_alert: true,
    });
    return;
  }
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.answerCbQuery(messages.taskStatusUnknownUser, {
      show_alert: true,
    });
    return;
  }
  const canUpdate = await ensureUserCanUpdateTask(
    ctx,
    taskId,
    userId,
    'Не удалось получить задачу перед отменой',
    { targetStatus: 'Отменена' },
  );
  if (!canUpdate) {
    try {
      await refreshTaskKeyboard(ctx, taskId);
    } catch (error) {
      console.error(
        'Не удалось восстановить клавиатуру после отказа отмены',
        error,
      );
    }
    return;
  }
  await processStatusAction(ctx, 'Отменена', messages.taskCanceled);
});

bot.action('task_cancel_cancel', async (ctx) => {
  await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});

bot.action(/^task_cancel_cancel:.+$/, async (ctx) => {
  const data = getCallbackData(ctx.callbackQuery);
  const taskId = getTaskIdFromCallback(data);
  if (!taskId) {
    await ctx.answerCbQuery(messages.taskStatusInvalidId, {
      show_alert: true,
    });
    return;
  }
  try {
    await refreshTaskKeyboard(ctx, taskId);
  } catch (error) {
    console.error(
      'Не удалось восстановить клавиатуру после отмены действия',
      error,
    );
  }
  await ctx.answerCbQuery(messages.taskStatusCanceled);
});

bot.action(/^task_cancel:.+$/, async (ctx) => {
  const data = getCallbackData(ctx.callbackQuery);
  const taskId = getTaskIdFromCallback(data);
  if (!taskId) {
    await ctx.answerCbQuery(messages.taskStatusInvalidId, {
      show_alert: true,
    });
    return;
  }
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.answerCbQuery(messages.taskStatusUnknownUser, {
      show_alert: true,
    });
    return;
  }
  const canUpdate = await ensureUserCanUpdateTask(
    ctx,
    taskId,
    userId,
    'Не удалось получить задачу перед отменой',
    { targetStatus: 'Отменена' },
  );
  if (!canUpdate) {
    try {
      await refreshTaskKeyboard(ctx, taskId);
    } catch (error) {
      console.error(
        'Не удалось восстановить клавиатуру после отказа отмены',
        error,
      );
    }
    return;
  }
  await processStatusAction(ctx, 'Отменена', messages.taskCanceled);
});

const registerTextHandler = bot.on?.bind(bot);
if (!registerTextHandler) {
  console.warn(
    'Метод bot.on недоступен, обработчик текстов не будет зарегистрирован',
  );
} else {
  registerTextHandler('text', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      return;
    }
    const commentSession = commentSessions.get(userId);
    if (commentSession) {
      if (ctx.chat?.type !== 'private') {
        return;
      }
      const messageText =
        typeof ctx.message?.text === 'string' ? ctx.message.text : '';
      const normalizedComment = messageText.replace(/\r\n/g, '\n').trim();
      if (!normalizedComment) {
        await ctx.reply(messages.enterComment);
        return;
      }
      try {
        const task = await getTask(commentSession.taskId);
        if (!task) {
          commentSessions.delete(userId);
          await ctx.reply(messages.taskNotFound);
          return;
        }
        const existing: Comment[] = Array.isArray(task.comments)
          ? [...(task.comments as Comment[])]
          : [];
        const entry: Comment = {
          author_id: userId,
          text: normalizedComment,
          created_at: new Date(),
        };
        const nextEntries = [...existing, entry];
        const authorIds = new Set<number>();
        nextEntries.forEach((item) => {
          const numeric = Number(item.author_id);
          if (Number.isFinite(numeric)) {
            authorIds.add(numeric);
          }
        });
        const usersRaw = await getUsersMap(Array.from(authorIds));
        const authorMeta: Record<number, { name?: string; username?: string }> =
          {};
        Object.entries(usersRaw ?? {}).forEach(([key, value]) => {
          const numeric = Number(key);
          if (!Number.isFinite(numeric)) {
            return;
          }
          const name =
            typeof value?.name === 'string' && value.name.trim()
              ? value.name.trim()
              : undefined;
          const username =
            typeof value?.username === 'string' && value.username.trim()
              ? value.username.trim()
              : undefined;
          authorMeta[numeric] = { name, username };
        });
        const fallbackNames: Record<number, string> = {};
        const nameParts = [ctx.from?.first_name, ctx.from?.last_name]
          .map((part) => (typeof part === 'string' ? part.trim() : ''))
          .filter((part) => part.length > 0);
        const fallbackName =
          nameParts.join(' ').trim() ||
          (ctx.from?.username ? `@${ctx.from.username}` : '') ||
          String(userId);
        fallbackNames[userId] = fallbackName;
        const commentHtml = buildCommentHtml(nextEntries, {
          users: authorMeta,
          fallbackNames,
        });
        const existingAttachments = Array.isArray(task.attachments)
          ? (task.attachments as Attachment[])
          : undefined;
        const commentAttachments = buildAttachmentsFromCommentHtml(
          commentHtml,
          {
            existing: existingAttachments,
          },
        );
        const updatePayload: Partial<TaskDocument> = {
          comment: commentHtml,
          comments: nextEntries,
        };
        if (commentAttachments.length > 0) {
          updatePayload.attachments = commentAttachments;
        }
        const updated = await updateTaskRecord(
          commentSession.taskId,
          updatePayload,
          userId,
        );
        if (!updated) {
          commentSessions.delete(userId);
          await ctx.reply(messages.taskNotFound);
          return;
        }
        commentSessions.delete(userId);
        await ctx.reply(messages.commentSaved);
        await taskSyncController.syncAfterChange(
          commentSession.taskId,
          updated,
        );
      } catch (error) {
        commentSessions.delete(userId);
        console.error('Не удалось сохранить комментарий задачи', error);
        await ctx.reply(messages.commentSaveError);
      }
      return;
    }
    const session = cancelRequestSessions.get(userId);
    if (!session || session.stage !== 'awaitingReason') {
      return;
    }
    if (ctx.chat?.type !== 'private') {
      return;
    }
    const messageText =
      typeof ctx.message?.text === 'string' ? ctx.message.text : '';
    const normalized = messageText.replace(/\r\n/g, '\n').trim();
    if (!normalized || normalized.length < CANCEL_REASON_MIN_LENGTH) {
      await ctx.reply(messages.cancelRequestReasonLength);
      return;
    }
    session.reason = normalized;
    session.stage = 'awaitingConfirm';
    cancelRequestSessions.set(userId, session);
    const preview =
      normalized.length > 500 ? `${normalized.slice(0, 500)}…` : normalized;
    const confirmRows: InlineKeyboardButton[][] = [
      [
        Markup.button.callback(
          'Подтвердить',
          `cancel_request_confirm:${session.taskId}`,
        ),
        Markup.button.callback(
          'Отмена',
          `cancel_request_abort:${session.taskId}`,
        ),
      ],
    ];
    const keyboard = Markup.inlineKeyboard(confirmRows) as ReturnType<
      typeof Markup.inlineKeyboard
    > & { reply_markup?: InlineKeyboardMarkup };
    if (!keyboard.reply_markup) {
      keyboard.reply_markup = { inline_keyboard: confirmRows };
    }
    await ctx.reply(
      `${messages.cancelRequestConfirmPrompt}\n\nЗадача: ${session.identifier}\nПричина:\n${preview}`,
      {
        reply_markup: keyboard.reply_markup,
      },
    );
  });
}

bot.action(/^cancel_request_confirm:.+$/, async (ctx) => {
  const data = getCallbackData(ctx.callbackQuery);
  const taskId = getTaskIdFromCallback(data);
  if (!taskId) {
    await ctx.answerCbQuery(messages.taskStatusInvalidId, {
      show_alert: true,
    });
    return;
  }
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.answerCbQuery(messages.taskStatusUnknownUser, {
      show_alert: true,
    });
    return;
  }
  const session = cancelRequestSessions.get(userId);
  if (!session || session.taskId !== taskId) {
    await ctx.answerCbQuery(messages.cancelRequestFailed, {
      show_alert: true,
    });
    return;
  }
  const reason = session.reason?.trim();
  if (!reason || reason.length < CANCEL_REASON_MIN_LENGTH) {
    await ctx.answerCbQuery(messages.cancelRequestReasonLength, {
      show_alert: true,
    });
    return;
  }
  try {
    await createCancellationRequestFromTask(taskId, userId, reason);
    cancelRequestSessions.delete(userId);
    try {
      await ctx.editMessageReplyMarkup(undefined);
    } catch (error) {
      console.warn('Не удалось обновить сообщение подтверждения отмены', error);
    }
    await ctx.answerCbQuery(messages.cancelRequestSuccess);
    await ctx.reply(
      `${messages.cancelRequestSuccess}\nЗадача: ${session.identifier}`,
    );
  } catch (error) {
    let response: string = messages.cancelRequestFailed;
    if (error instanceof CancellationRequestError) {
      switch (error.code) {
        case 'not_found':
          response = messages.taskNotFound;
          break;
        case 'not_executor':
          response = messages.taskAssignmentRequired;
          break;
        case 'creator_missing':
          response = messages.cancelRequestCreatorMissing;
          break;
        case 'unsupported':
          response = messages.cancelRequestUnavailable;
          break;
        default:
          response = messages.cancelRequestFailed;
      }
    } else {
      console.error('Не удалось создать заявку на удаление задачи', error);
    }
    await ctx.answerCbQuery(response, { show_alert: true });
  }
});

bot.action(/^cancel_request_abort:.+$/, async (ctx) => {
  const data = getCallbackData(ctx.callbackQuery);
  const taskId = getTaskIdFromCallback(data);
  const userId = ctx.from?.id;
  if (userId) {
    const session = cancelRequestSessions.get(userId);
    if (session && (!taskId || session.taskId === taskId)) {
      cancelRequestSessions.delete(userId);
    }
  }
  try {
    await ctx.editMessageReplyMarkup(undefined);
  } catch (error) {
    console.warn('Не удалось обновить сообщение отмены заявки', error);
  }
  await ctx.answerCbQuery(messages.cancelRequestCanceled);
  if (ctx.chat?.type === 'private') {
    await ctx.reply(messages.cancelRequestCanceled);
  }
});

const retryableCodes = new Set([409, 429, 502, 504]);

export async function startBot(retry = 0): Promise<void> {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.launch({ dropPendingUpdates: true });
    console.log('Бот запущен');
  } catch (err: unknown) {
    const e = err as { response?: { error_code?: number } };
    const code = e.response?.error_code;
    const isConflict = code === 409;
    const isRateLimited = code === 429;
    const canRetry = retry < MAX_RETRIES || isConflict || isRateLimited;
    if (retryableCodes.has(code ?? 0) && canRetry) {
      if (isConflict) {
        console.warn(
          'Обнаружен активный запрос getUpdates, сбрасываем предыдущую сессию',
        );
        await resetLongPollingSession();
      }
      if (isRateLimited) {
        await waitForRetryAfter(err, 'Telegram вернул 429 при запуске бота');
      }
      console.error('Ошибка Telegram, повторная попытка запуска');
      const delay = 1000 * 2 ** retry;
      await sleep(delay);
      const nextRetry = isConflict || isRateLimited ? retry : retry + 1;
      return startBot(nextRetry);
    }
    console.error('Не удалось запустить бота:', err);
    throw err;
  }
  console.log(
    `Окружение: ${process.env.NODE_ENV || 'development'}, Node ${process.version}`,
  );
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export const __resetCloseThrottleForTests = (): void => {
  if (process.env.NODE_ENV === 'test') {
    closeThrottleUntil = 0;
  }
};

export { processStatusAction };
export { handleReportCommand };
