// Назначение: основной файл Telegram-бота
// Основные модули: dotenv, telegraf, service, scheduler, config
import 'dotenv/config';
import { botToken, chatId } from '../config';
import { Telegraf, Markup, Context } from 'telegraf';
import messages from '../messages';
import { createUser, getUser } from '../services/service';
import { startScheduler } from '../services/scheduler';
import { startKeyRotation } from '../services/keyRotation';
import '../db/model';
import { Fleet } from '../db/models/fleet';
import { Vehicle } from '../db/models/vehicle';

if (process.env.NODE_ENV !== 'production') {
  console.log('BOT_TOKEN загружен');
}

const bot = new Telegraf(botToken!);

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

function formatVehicleLine(vehicle: {
  name: string;
  unitId: number;
  position?: {
    lat?: number;
    lon?: number;
    speed?: number;
    updatedAt?: Date | string;
  };
  sensors?: { name: string; value?: unknown }[];
}): string {
  const title = vehicle.name || `Юнит ${vehicle.unitId}`;
  const pos = vehicle.position;
  if (!pos || typeof pos.lat !== 'number' || typeof pos.lon !== 'number') {
    return `• ${title}: ${messages.vehicleNoPosition}`;
  }
  const coords = `${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}`;
  const parts: string[] = [coords];
  if (typeof pos.speed === 'number') {
    parts.push(`скорость ${Math.round(pos.speed)} км/ч`);
  }
  if (pos.updatedAt) {
    const date =
      pos.updatedAt instanceof Date
        ? pos.updatedAt
        : new Date(pos.updatedAt as string);
    if (!Number.isNaN(date.getTime())) {
      parts.push(`обновлено ${date.toLocaleString('ru-RU')}`);
    }
  }
  const firstSensor = vehicle.sensors?.find((sensor) => sensor.value !== undefined);
  if (firstSensor) {
    parts.push(`${firstSensor.name}: ${String(firstSensor.value)}`);
  }
  return `• ${title}: ${parts.join(', ')}`;
}

async function sendFleetVehicles(ctx: Context): Promise<void> {
  try {
    const fleets = await Fleet.find().lean();
    if (!fleets.length) {
      await ctx.reply(messages.noFleets);
      return;
    }
    const sections: string[] = [];
    for (const fleet of fleets) {
      const vehicles = await Vehicle.find({ fleetId: fleet._id }).lean();
      if (!vehicles.length) {
        sections.push(`${fleet.name}: ${messages.noVehicles}`);
        continue;
      }
      const lines = vehicles.map((vehicle) =>
        formatVehicleLine({
          name: vehicle.name,
          unitId: vehicle.unitId,
          position: vehicle.position,
          sensors: vehicle.sensors,
        }),
      );
      sections.push(`${fleet.name}:\n${lines.join('\n')}`);
    }
    if (!sections.length) {
      await ctx.reply(messages.noVehicles);
      return;
    }
    await ctx.reply(sections.join('\n\n'));
  } catch (error) {
    console.error('Не удалось отправить список транспорта:', error);
    await ctx.reply(messages.vehiclesError);
  }
}

bot.command('vehicles', sendFleetVehicles);
bot.hears('Транспорт', sendFleetVehicles);

const MAX_RETRIES = 5;

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
