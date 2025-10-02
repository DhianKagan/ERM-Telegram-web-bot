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
  updateTaskStatusMessageId,
} from '../tasks/taskHistory.service';
import { buildLatestHistorySummary } from '../tasks/taskMessages';
import taskStatusKeyboard, {
  taskAcceptConfirmKeyboard,
  taskDoneConfirmKeyboard,
} from '../utils/taskButtons';

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
  status: 'В работе' | 'Выполнена',
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
  try {
    const task = await updateTaskStatus(taskId, status, userId);
    if (!task) {
      await ctx.answerCbQuery(messages.taskNotFound, { show_alert: true });
      return;
    }
    await ctx.answerCbQuery(responseMessage);
    const docId =
      typeof task._id === 'object' && task._id !== null && 'toString' in task._id
        ? (task._id as { toString(): string }).toString()
        : String(task._id ?? taskId);
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
              await updateTaskStatusMessageId(docId, statusMessage.message_id);
            }
          }
        }
      } catch (error) {
        console.error('Не удалось обновить историю статусов задачи', error);
      }
      try {
        const summary = await buildLatestHistorySummary(
          task as Parameters<typeof buildLatestHistorySummary>[0],
        );
        if (summary) {
          const statusMessageId =
            typeof task.telegram_status_message_id === 'number'
              ? task.telegram_status_message_id
              : undefined;
          const topicId =
            typeof task.telegram_topic_id === 'number'
              ? task.telegram_topic_id
              : undefined;
          const replyTo =
            typeof task.telegram_message_id === 'number'
              ? task.telegram_message_id
              : undefined;
          const editOptions: NonNullable<
            Parameters<typeof bot.telegram.editMessageText>[4]
          > = {
            link_preview_options: { is_disabled: true },
          };
          const sendOptions: NonNullable<
            Parameters<typeof bot.telegram.sendMessage>[2]
          > = {
            link_preview_options: { is_disabled: true },
          };
          if (typeof topicId === 'number') {
            sendOptions.message_thread_id = topicId;
          }
          if (typeof replyTo === 'number') {
            sendOptions.reply_parameters = { message_id: replyTo };
          }
          if (statusMessageId) {
            try {
              await bot.telegram.editMessageText(
                chatId,
                statusMessageId,
                undefined,
                summary,
                editOptions,
              );
            } catch (summaryError) {
              console.error(
                'Не удалось обновить краткое сообщение задачи',
                summaryError,
              );
              const sentSummary = await bot.telegram.sendMessage(
                chatId,
                summary,
                sendOptions,
              );
              if (sentSummary?.message_id) {
                await updateTaskStatusMessageId(docId, sentSummary.message_id);
              }
            }
          } else {
            const sentSummary = await bot.telegram.sendMessage(
              chatId,
              summary,
              sendOptions,
            );
            if (sentSummary?.message_id) {
              await updateTaskStatusMessageId(docId, sentSummary.message_id);
            }
          }
        }
      } catch (summaryError) {
        console.error('Не удалось синхронизировать краткое сообщение задачи', summaryError);
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
