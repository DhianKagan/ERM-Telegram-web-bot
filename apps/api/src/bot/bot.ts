// Назначение: основной файл Telegram-бота
// Основные модули: dotenv, telegraf, service, scheduler, config, taskHistory.service
import 'dotenv/config';
import { botToken, chatId } from '../config';
import { Telegraf, Markup, Context } from 'telegraf';
import messages from '../messages';
import {
  createUser,
  getTask,
  getUser,
  updateTaskStatus,
} from '../services/service';
import '../db/model';
import { FleetVehicle, type FleetVehicleAttrs } from '../db/models/fleet';
import {
  getTaskHistoryMessage,
  updateTaskHistoryMessageId,
} from '../tasks/taskHistory.service';
import taskStatusKeyboard, {
  taskAcceptConfirmKeyboard,
  taskCancelConfirmKeyboard,
  taskDoneConfirmKeyboard,
} from '../utils/taskButtons';
import buildChatMessageLink from '../utils/messageLink';
import formatTask from '../utils/formatTask';
import { getUsersMap } from '../db/queries';
import { buildHistorySummaryLog, getTaskIdentifier } from '../tasks/taskMessages';
import { PROJECT_TIMEZONE, PROJECT_TIMEZONE_LABEL } from 'shared';
import type { Task as SharedTask } from 'shared';

if (process.env.NODE_ENV !== 'production') {
  console.log('BOT_TOKEN загружен');
}

export const bot: Telegraf<Context> = new Telegraf(botToken!);

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection in bot:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in bot:', err);
  process.exit(1);
});

async function showMainMenu(ctx: Context): Promise<void> {
  await ctx.reply(
    messages.menuPrompt,
    Markup.keyboard([
      ['Регистрация', 'ERM'],
      ['Транспорт'],
    ]).resize(),
  );
}

async function checkAndRegister(ctx: Context): Promise<void> {
  try {
    const member = await bot.telegram.getChatMember(chatId!, ctx.from!.id);
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
bot.hears('Регистрация', checkAndRegister);
bot.hears('ERM', async (ctx) => {
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
    const lines = vehicles.map((vehicle) =>
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

bot.command('vehicles', sendFleetVehicles);
bot.hears('Транспорт', sendFleetVehicles);

const MAX_RETRIES = 5;

const getCallbackData = (
  callback: Context['callbackQuery'],
): string | null => {
  if (!callback) return null;
  if ('data' in callback && typeof callback.data === 'string') return callback.data;
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
  Новая: '🆕 Новая',
  'В работе': '🟢 В работе',
  Выполнена: '✅ Выполнена',
  Отменена: '⛔️ Отменена',
};

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
  const formatted = directMessageDateFormatter
    .format(date)
    .replace(', ', ' ');
  return `${formatted} (${PROJECT_TIMEZONE_LABEL})`;
};

const toNumericId = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const collectTaskUserIds = (
  task: Record<string, unknown>,
): number[] => {
  const ids = new Set<number>();
  const singleKeys: (keyof typeof task)[] = [
    'assigned_user_id',
    'controller_user_id',
    'created_by',
  ];
  singleKeys.forEach((key) => {
    const value = task[key as keyof typeof task];
    const id = toNumericId(value);
    if (id !== null) {
      ids.add(id);
    }
  });
  const arrayKeys: (keyof typeof task)[] = ['assignees', 'controllers'];
  arrayKeys.forEach((key) => {
    const raw = task[key as keyof typeof task];
    if (!Array.isArray(raw)) return;
    raw.forEach((item) => {
      const id = toNumericId(item);
      if (id !== null) {
        ids.add(id);
      }
    });
  });
  return Array.from(ids);
};

const buildUsersIndex = async (
  ids: number[],
): Promise<Record<number, { name: string; username: string }>> => {
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
        return [numericId, { name, username }] as const;
      })
      .filter(
        (entry): entry is readonly [number, { name: string; username: string }] =>
          entry !== null,
      );
    return Object.fromEntries(entries) as Record<
      number,
      { name: string; username: string }
    >;
  } catch (error) {
    console.error('Не удалось получить данные пользователей задачи', error);
    return {};
  }
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
  users: Record<number, { name: string; username: string }>,
): string => {
  const lines: string[] = [];
  const identifier = getTaskIdentifier(task);
  const title = typeof task.title === 'string' ? task.title.trim() : '';
  const headerContent = (() => {
    if (link) {
      const label = identifier ? htmlEscape(identifier) : 'по ссылке';
      return `<a href="${link}">${label}</a>`;
    }
    return identifier ? `<b>${htmlEscape(identifier)}</b>` : '<b>без номера</b>';
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
    typeof task.start_location === 'string'
      ? task.start_location.trim()
      : '';
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
    lines.push(`Маршрут: <b>${htmlEscape(`${distance} км`)}</b>`);
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
  return lines.join('\n');
};

type TaskPresentation = SharedTask &
  Record<string, unknown> & { telegram_topic_id?: number };

const loadTaskContext = async (
  taskId: string,
  override?: TaskPresentation,
): Promise<{
  plain: TaskPresentation | null;
  users: Record<number, { name: string; username: string }>;
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
  users: Record<number, { name: string; username: string }>;
}> => {
  const context = await loadTaskContext(taskId, override);
  const { plain, users } = context;
  if (!plain) {
    return context;
  }
  if (!chatId) {
    return context;
  }
  try {
    const messageId = toNumericId(plain.telegram_message_id);
    const status =
      typeof plain.status === 'string'
        ? (plain.status as SharedTask['status'])
        : undefined;
    if (messageId !== null) {
      const formatted = formatTask(plain as SharedTask, users);
      const keyboard = taskStatusKeyboard(taskId, status);
      const options: Parameters<typeof bot.telegram.editMessageText>[4] = {
        parse_mode: 'MarkdownV2',
        link_preview_options: { is_disabled: true },
        ...(keyboard.reply_markup ? { reply_markup: keyboard.reply_markup } : {}),
      };
      await bot.telegram.editMessageText(
        chatId,
        messageId,
        undefined,
        formatted.text,
        options,
      );
    }
    const summaryId = toNumericId(
      plain.telegram_summary_message_id ?? plain.telegram_status_message_id,
    );
    if (summaryId !== null) {
      const summary = await buildHistorySummaryLog(
        plain as Parameters<typeof buildHistorySummaryLog>[0],
      );
      if (summary) {
        const options: Parameters<typeof bot.telegram.editMessageText>[4] = {
          link_preview_options: { is_disabled: true },
        };
        await bot.telegram.editMessageText(
          chatId,
          summaryId,
          undefined,
          summary,
          options,
        );
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
): Promise<boolean> {
  try {
    const task = await getTask(taskId);
    if (!task) {
      await ctx.answerCbQuery(messages.taskNotFound, { show_alert: true });
      return false;
    }
    const assignedUserId =
      typeof task.assigned_user_id === 'number'
        ? task.assigned_user_id
        : undefined;
    const assignees = Array.isArray(task.assignees)
      ? task.assignees.map((value) => Number(value))
      : [];
    const hasAssignments =
      typeof assignedUserId === 'number' || assignees.length > 0;
    const isAllowed =
      (typeof assignedUserId === 'number' && assignedUserId === userId) ||
      assignees.includes(userId);
    if (hasAssignments && !isAllowed) {
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
  const keyboard = taskStatusKeyboard(taskId);
  await ctx.editMessageReplyMarkup(keyboard.reply_markup ?? undefined);
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.answerCbQuery(messages.taskStatusUnknownUser, {
      show_alert: true,
    });
    return;
  }
  try {
    try {
      const current = await getTask(taskId);
      const currentStatus = current?.status;
      if (
        typeof currentStatus === 'string' &&
        currentStatus === 'Выполнена' &&
        status !== 'Отменена' &&
        status !== 'Выполнена'
      ) {
        await ctx.answerCbQuery(messages.taskCompletedLock, {
          show_alert: true,
        });
        return;
      }
    } catch (error) {
      console.error('Не удалось проверить текущий статус задачи', error);
    }
    const task = await updateTaskStatus(taskId, status, userId);
    if (!task) {
      await ctx.answerCbQuery(messages.taskNotFound, { show_alert: true });
      return;
    }
    const docId =
      typeof task._id === 'object' && task._id !== null && 'toString' in task._id
        ? (task._id as { toString(): string }).toString()
        : String(task._id ?? taskId);
    const overrideRaw =
      typeof (task as { toObject?: () => unknown }).toObject === 'function'
        ? (task as { toObject(): unknown }).toObject()
        : (task as unknown);
    const override = overrideRaw as TaskPresentation;
    const presentation = await syncTaskPresentation(docId, override);
    const appliedStatus =
      (presentation.plain?.status as SharedTask['status'] | undefined) ?? status;
    const keyboard = taskStatusKeyboard(taskId, appliedStatus);
    if (ctx.chat?.type === 'private') {
      const link = buildChatMessageLink(
        chatId,
        toNumericId(presentation.plain?.telegram_message_id ?? null) ?? undefined,
      );
      const dmText = buildDirectTaskMessage(
        presentation.plain ?? override,
        link,
        presentation.users,
      );
      try {
        await ctx.editMessageText(dmText, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          ...(keyboard.reply_markup
            ? { reply_markup: keyboard.reply_markup }
            : {}),
        });
      } catch (error) {
        console.warn('Не удалось обновить личное уведомление задачи', error);
        if (keyboard.reply_markup) {
          try {
            await ctx.editMessageReplyMarkup(keyboard.reply_markup);
          } catch (updateError) {
            console.warn('Не удалось обновить клавиатуру уведомления', updateError);
          }
        }
      }
    } else if (keyboard.reply_markup) {
      try {
        await ctx.editMessageReplyMarkup(keyboard.reply_markup);
      } catch (error) {
        console.warn('Не удалось обновить клавиатуру статуса', error);
      }
    }
    await ctx.answerCbQuery(responseMessage);
    if (docId && chatId) {
      try {
        const payload = await getTaskHistoryMessage(docId);
        if (payload) {
          const { messageId, text, topicId } = payload;
          if (messageId) {
            await bot.telegram.editMessageText(
              chatId,
              messageId,
              undefined,
              text,
              {
                parse_mode: 'MarkdownV2',
                link_preview_options: { is_disabled: true },
              },
            );
            if (Number.isFinite(messageId)) {
              await updateTaskHistoryMessageId(docId, messageId);
            }
          } else {
            const options: NonNullable<
              Parameters<typeof bot.telegram.sendMessage>[2]
            > = {
              parse_mode: 'MarkdownV2',
              link_preview_options: { is_disabled: true },
            };
            if (typeof topicId === 'number') {
              options.message_thread_id = topicId;
            }
            const statusMessage = await bot.telegram.sendMessage(
              chatId,
              text,
              options,
            );
            if (statusMessage?.message_id) {
              await updateTaskHistoryMessageId(docId, statusMessage.message_id);
            }
          }
        }
      } catch (error) {
        console.error('Не удалось обновить историю статусов задачи', error);
      }
    }
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
  await ctx.editMessageReplyMarkup(keyboard.reply_markup ?? undefined);
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
  const keyboard = taskStatusKeyboard(taskId);
  await ctx.editMessageReplyMarkup(keyboard.reply_markup ?? undefined);
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
    'Не удалось получить задачу перед подтверждением',
  );
  if (!canUpdate) {
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
  const keyboard = taskStatusKeyboard(taskId);
  await ctx.editMessageReplyMarkup(keyboard.reply_markup ?? undefined);
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
  await ctx.editMessageReplyMarkup(keyboard.reply_markup ?? undefined);
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
  const keyboard = taskStatusKeyboard(taskId);
  await ctx.editMessageReplyMarkup(keyboard.reply_markup ?? undefined);
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
    'Не удалось получить задачу перед завершением',
  );
  if (!canUpdate) {
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
  const keyboard = taskStatusKeyboard(taskId);
  await ctx.editMessageReplyMarkup(keyboard.reply_markup ?? undefined);
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

bot.action(/^task_cancel_prompt:.+$/, async (ctx) => {
  const data = getCallbackData(ctx.callbackQuery);
  const taskId = getTaskIdFromCallback(data);
  if (!taskId) {
    await ctx.answerCbQuery(messages.taskStatusInvalidId, {
      show_alert: true,
    });
    return;
  }
  const keyboard = taskCancelConfirmKeyboard(taskId);
  await ctx.editMessageReplyMarkup(keyboard.reply_markup ?? undefined);
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
  );
  if (!canUpdate) {
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
  const keyboard = taskStatusKeyboard(taskId);
  await ctx.editMessageReplyMarkup(keyboard.reply_markup ?? undefined);
  await ctx.answerCbQuery(messages.taskStatusCanceled);
});

bot.action(/^task_cancel:.+$/, async (ctx) => {
  await processStatusAction(ctx, 'Отменена', messages.taskCanceled);
});

export async function startBot(retry = 0): Promise<void> {
  try {
    await bot.telegram.deleteWebhook();
    await bot.launch({ dropPendingUpdates: true });
    console.log('Бот запущен');
  } catch (err: unknown) {
    const e = err as { response?: { error_code?: number } };
    const code = e.response?.error_code;
    if ([409, 502, 504].includes(code ?? 0) && retry < MAX_RETRIES) {
      console.error('Ошибка Telegram, повторная попытка запуска');
      const delay = 1000 * 2 ** retry;
      await new Promise((res) => setTimeout(res, delay));
      return startBot(retry + 1);
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

export { processStatusAction };
