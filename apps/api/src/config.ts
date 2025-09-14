// Назначение: централизованная загрузка переменных окружения.
// Модули: path, dotenv, process
import path from 'path';
import dotenv from 'dotenv';

// Загружаем .env из корня проекта, чтобы избежать undefined переменных при запуске из каталога bot
dotenv.config({ path: path.resolve(__dirname, '../..', '.env') });

const required = ['BOT_TOKEN', 'CHAT_ID', 'JWT_SECRET', 'APP_URL'] as const;
// Пропускаем проверку при сборке без токена
if (process.env.NODE_ENV !== 'production-build') {
  for (const k of required) {
    if (!process.env[k]) throw new Error(`Переменная ${k} не задана`);
  }
}

const mongoUrlEnv = (
  process.env.MONGO_DATABASE_URL ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL ||
  ''
).trim();
if (!/^mongodb(\+srv)?:\/\//.test(mongoUrlEnv)) {
  throw new Error(
    'MONGO_DATABASE_URL должен начинаться с mongodb:// или mongodb+srv://',
  );
}

const appUrlEnv = (process.env.APP_URL || '').trim();
if (!/^https:\/\//.test(appUrlEnv)) {
  throw new Error(
    'APP_URL должен начинаться с https://, иначе Web App не будет работать',
  );
}

const routingUrlEnv = (
  process.env.ROUTING_URL || 'https://localhost:8000/route'
).trim();
if (!/^https:\/\//.test(routingUrlEnv)) {
  throw new Error('ROUTING_URL должен начинаться с https://');
}

let cookieDomainEnv = (process.env.COOKIE_DOMAIN || '').trim();
if (cookieDomainEnv) {
  if (/^https?:\/\//.test(cookieDomainEnv)) {
    try {
      cookieDomainEnv = new URL(cookieDomainEnv).hostname;
    } catch {
      throw new Error('COOKIE_DOMAIN имеет неверный формат');
    }
  }
  const domainReg =
    /^([.]?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
  if (!domainReg.test(cookieDomainEnv)) {
    throw new Error('COOKIE_DOMAIN имеет неверный формат');
  }
}

export const botToken = process.env.BOT_TOKEN;
export const botApiUrl = process.env.BOT_API_URL;
export const chatId = process.env.CHAT_ID;
export const jwtSecret = process.env.JWT_SECRET;
export const mongoUrl = mongoUrlEnv;
export const appUrl = appUrlEnv;
// Приводим порт к числу для корректной передачи в listen
export const port = Number.parseInt(process.env.PORT ?? '', 10) || 3000;
export const locale = process.env.LOCALE || 'ru';
export const routingUrl = routingUrlEnv;
export const cookieDomain = cookieDomainEnv;
export const adminRoleId =
  process.env.ADMIN_ROLE_ID || '686591126cc86a6bd16c18af';
export const userRoleId =
  process.env.USER_ROLE_ID || '686633fdf6896f1ad3fa063e';
export const managerRoleId =
  process.env.MANAGER_ROLE_ID || '686633fdf6896f1ad3fa063f';

const config = {
  botToken,
  botApiUrl,
  chatId,
  jwtSecret,
  mongoUrl,
  appUrl,
  port,
  locale,
  routingUrl,
  cookieDomain,
  adminRoleId,
  userRoleId,
  managerRoleId,
};

export default config;
