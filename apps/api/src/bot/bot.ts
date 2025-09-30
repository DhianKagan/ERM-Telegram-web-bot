// Назначение: основной файл Telegram-бота
// Основные модули: dotenv, telegraf, service, scheduler, config, taskHistory.service
import 'dotenv/config';
import { botToken, chatId } from '../config';
import { Telegraf, Markup, Context } from 'telegraf';
import messages from '../messages';
import { createUser, getUser, updateTaskStatus } from '../services/service';
import { startScheduler } from '../services/scheduler';
import { startKeyRotation } from '../services/keyRotation';
import '../db/model';
import { FleetVehicle, type FleetVehicleAttrs } from '../db/models/fleet';
import {
  getTaskHistoryMessage,
  updateTaskStatusMessageId,
} from '../tasks/taskHistory.service';

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

async function processStatusAction(
  ctx: Context,
  status: 'В работе' | 'Выполнена',
  responseMessage: string,
) {
  const data = getCallbackData(ctx.callbackQuery);
  const taskId = data?.split(':')[1];
  if (!taskId) {
    await ctx.answerCbQuery('Некорректный идентификатор задачи', {
      show_alert: true,
    });
    return;
  }
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.answerCbQuery('Не удалось определить пользователя', {
      show_alert: true,
    });
    return;
  }
  try {
    const task = await updateTaskStatus(taskId, status, userId);
    if (!task) {
      await ctx.answerCbQuery('Задача не найдена', { show_alert: true });
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
              { parse_mode: 'MarkdownV2' },
            );
          } else {
            const options: Parameters<typeof bot.telegram.sendMessage>[2] = {
              parse_mode: 'MarkdownV2',
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
    }
  } catch (error) {
    console.error('Не удалось обновить статус задачи', error);
    await ctx.answerCbQuery('Ошибка обновления статуса задачи', {
      show_alert: true,
    });
  }
}

bot.action('task_accept', async (ctx) => {
  await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});

bot.action(/^task_accept:.+$/, async (ctx) => {
  await processStatusAction(ctx, 'В работе', messages.taskAccepted);
});

bot.action('task_done', async (ctx) => {
  await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
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

if (process.env.NODE_ENV !== 'test') {
  startBot().then(() => {
    startScheduler();
    startKeyRotation();
  });
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export { processStatusAction };
