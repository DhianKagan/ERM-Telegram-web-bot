#!/usr/bin/env node
// patch: 037-sync-railway-envs.cjs
// purpose: синхронизировать env-шаблоны с конфигурацией Railway и картой
const fs = require('fs');
const path = require('path');

const writeFile = (targetPath, content) => {
  const normalized = content.replace(/\r\n/g, '\n');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, normalized, 'utf8');
  console.log(`updated ${path.relative(process.cwd(), targetPath)}`);
};

writeFile(
  path.resolve('.env.example'),
  `# Назначение файла: пример переменных окружения для бота, API и клиента.
# Внимание: это только примеры. Реальные секреты не коммитим и храним в Secret Store/локально.

# --- Telegram и роли ---
BOT_TOKEN=rotated_bot_token
BOT_USERNAME=ERP_AM_BOT
CHAT_ID=-1002705661520
ADMIN_ROLE_ID=686591126cc86a6bd16c18af
USER_ROLE_ID=686633fdf6896f1ad3fa063e
BOT_API_URL=https://api.telegram.org

# --- Секреты и безопасность ---
JWT_SECRET=rotated_jwt_secret
SESSION_SECRET=
LHCI_TOKEN=
LHCI_GITHUB_APP_TOKEN=
NODE_ENV=production
LOCALE=ru
SCHEDULE_CRON=*/1 * * * *
COOKIE_SECURE=true
DISABLE_CSRF=0
CAPTCHA_TOKEN=
LOG_LEVEL=

# --- База данных ---
# По умолчанию используем локальный контейнер Docker
MONGO_DATABASE_URL=mongodb://admin:admin@localhost:27017/ermdb?authSource=admin
# Для Railway — внутренний адрес с авторизацией в admin
# MONGO_DATABASE_URL=mongodb://mongo:<пароль>@erm-mongodb.railway.internal:27017/test?authSource=admin

# --- Приложение и API ---
APP_URL=https://agromarket.up.railway.app
APP_ORIGIN=http://localhost:5173
CORS_ORIGINS=https://agromarket.up.railway.app,http://localhost:5173
COOKIE_DOMAIN=agromarket.up.railway.app
ROUTING_URL=https://orsm-production.up.railway.app/route
OSRM_ALGORITHM=mld
PROTOMAPS_API_KEY=
STORAGE_DIR=/storage
RAILWAY_DOCKERFILE_PATH=Dockerfile

# --- CSP и карта ---
CSP_REPORT_ONLY=true
CSP_CONNECT_SRC_ALLOWLIST=https://protomaps.github.io
CSP_IMG_SRC_ALLOWLIST=https://protomaps.github.io
CSP_SCRIPT_SRC_ALLOWLIST=blob:
CSP_STYLE_SRC_ALLOWLIST=
CSP_FONT_SRC_ALLOWLIST=https://protomaps.github.io
CSP_WORKER_SRC_ALLOWLIST=

# --- Порты (локальная разработка) ---
PORT=3000
HOST_PORT=3000
# На Railway удалите PORT и HOST_PORT — платформа передаст RAILWAY_TCP_PORT.

# --- Клиент (apps/web / Vite) ---
VITE_BOT_USERNAME=ERP_AM_BOT
VITE_CHAT_ID=-1002705661520
VITE_ROUTING_URL=https://orsm-production.up.railway.app/route
VITE_MAP_STYLE_URL=https://api.protomaps.com/styles/v5/light/uk.json?key=e2ee205f93bfd080
VITE_MAP_ADDRESSES_PMTILES_URL=pmtiles://tiles/addresses.pmtiles
VITE_MAP_STYLE_MODE=pmtiles
VITE_USE_PMTILES=1
VITE_DISABLE_SSE=0
VITE_LOGISTICS_POLL_INTERVAL_MS=
`
);

writeFile(
  path.resolve('Railway/.env'),
  `# Назначение файла: пример продакшен-переменных Railway. Секреты заполняем в консоли Railway.
NODE_ENV=production

# Telegram / роли
BOT_TOKEN=<укажите_в_Railway>
BOT_USERNAME=ERP_AM_BOT
BOT_API_URL=https://api.telegram.org
CHAT_ID=-1002705661520
ADMIN_ROLE_ID=686591126cc86a6bd16c18af
USER_ROLE_ID=686633fdf6896f1ad3fa063e
JWT_SECRET=<укажите_в_Railway>
SESSION_SECRET=<укажите_в_Railway>

# База данных
MONGO_DATABASE_URL=mongodb://mongo:<пароль>@erm-mongodb.railway.internal:27017/test?authSource=admin

# Приложение и API
APP_URL=https://agromarket.up.railway.app
APP_ORIGIN=https://agromarket.up.railway.app
LOCALE=ru
SCHEDULE_CRON=*/1 * * * *
STORAGE_DIR=/storage
CORS_ORIGINS=https://agromarket.up.railway.app,https://api.protomaps.com
COOKIE_DOMAIN=agromarket.up.railway.app
RAILWAY_DOCKERFILE_PATH=Dockerfile

# Карта и CSP
ROUTING_URL=https://orsm-production.up.railway.app/route
VITE_ROUTING_URL=https://orsm-production.up.railway.app/route
VITE_MAP_STYLE_URL=https://api.protomaps.com/styles/v5/light/uk.json?key=e2ee205f93bfd080
VITE_MAP_ADDRESSES_PMTILES_URL=pmtiles://tiles/addresses.pmtiles
VITE_MAP_STYLE_MODE=pmtiles
VITE_USE_PMTILES=1
VITE_DISABLE_SSE=0
VITE_BOT_USERNAME=ERP_AM_BOT
VITE_CHAT_ID=-1002705661520

CSP_CONNECT_SRC_ALLOWLIST=https://protomaps.github.io
CSP_FONT_SRC_ALLOWLIST=https://protomaps.github.io
CSP_IMG_SRC_ALLOWLIST=https://protomaps.github.io
CSP_SCRIPT_SRC_ALLOWLIST=blob:
CSP_STYLE_SRC_ALLOWLIST=
CSP_REPORT_ONLY=true

# Railway подставляет порт автоматически, переменные PORT и HOST_PORT не задаём

LHCI_GITHUB_APP_TOKEN=
`
);

writeFile(
  path.resolve('apps/web/.env'),
  `VITE_BOT_USERNAME=ERP_AM_BOT
VITE_CHAT_ID=-1002705661520
VITE_ROUTING_URL=https://orsm-production.up.railway.app/route
VITE_MAP_STYLE_URL=https://api.protomaps.com/styles/v5/light/uk.json?key=e2ee205f93bfd080
VITE_MAP_ADDRESSES_PMTILES_URL=pmtiles://tiles/addresses.pmtiles
VITE_MAP_STYLE_MODE=pmtiles
VITE_USE_PMTILES=1
VITE_DISABLE_SSE=0
`
);

writeFile(
  path.resolve('apps/web/src/types/env.d.ts'),
  `// Назначение: декларация переменных окружения Vite для веб-клиента.
// Основные модули: отсутствуют.

declare global {
  interface ImportMetaEnv {
    readonly VITE_DISABLE_SSE?: string;
    readonly VITE_MAP_STYLE_URL?: string;
    readonly VITE_MAP_STYLE_MODE?: string;
    readonly VITE_MAP_ADDRESSES_PMTILES_URL?: string;
    readonly VITE_ROUTING_URL?: string;
    readonly VITE_USE_PMTILES?: string;
    readonly VITE_LOGISTICS_POLL_INTERVAL_MS?: string;
    readonly VITE_BOT_USERNAME?: string;
    readonly VITE_CHAT_ID?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
`
);

writeFile(
  path.resolve('docs/railway_env_review.md'),
  `<!-- Назначение файла: чек-лист проверки переменных Railway и рекомендации по их корректировке. -->

# Проверка переменных Railway

Ниже собраны выводы по представленному набору переменных окружения.

## Обязательные переменные

- Все ключевые секреты присутствуют (BOT_TOKEN, CHAT_ID, JWT_SECRET, SESSION_SECRET) и должны оставаться секретами в Railway.
- NODE_ENV=production и LOCALE=ru соответствуют настройкам продакшена.
- ADMIN_ROLE_ID и USER_ROLE_ID совпадают с актуальными значениями.

## MongoDB

- Используется внутренний адрес Railway "erm-mongodb.railway.internal" с указанием базы "test" и параметра "authSource=admin", что проходит валидацию конфигурации.
- Пароль хранится в Railway; при необходимости можно добавить параметр "directConnection=true", но текущая строка уже валидна для приватной сети Railway.

## URL-адреса и карта

- APP_URL и COOKIE_DOMAIN указывают на "https://agromarket.up.railway.app", CORS_ORIGINS включает домен клиента и протокольный источник Protomaps.
- ROUTING_URL и VITE_ROUTING_URL направлены на OSRM "/route", карта использует стиль Protomaps и адресные плитки pmtiles://tiles/addresses.pmtiles.
- CSP allowlist дополнен источниками "https://protomaps.github.io" и разрешением "blob:" для скриптов, поэтому загрузка стиля и шрифтов Protomaps не должна блокироваться.

## Порты

- Переменные PORT и HOST_PORT очищены: Railway выдаёт порт автоматически через RAILWAY_TCP_PORT/PORT. После обновления переменных перезапустите сервис, чтобы конфигурация применилась.

## Дополнительные параметры

- SCHEDULE_CRON=*/1 * * * * запускает планировщик ежеминутно; STORAGE_DIR=/storage и RAILWAY_DOCKERFILE_PATH=Dockerfile совпадают с инфраструктурой.
- VITE_* значения для бота и карты синхронизированы между API и клиентом, что исключает рассинхронизацию CSP и фронтенда.

## Итог

1. Очистите PORT и HOST_PORT в настройках Railway, чтобы использовался порт платформы.
2. После очистки перезапустите сервис Railway, чтобы новый порт подтянулся из переменных платформы.
3. Оставьте текущую строку MONGO_DATABASE_URL с authSource=admin и внутренним хостом; при переносе в публичный прокси добавьте "directConnection=true".
4. Убедитесь, что карта использует те же URL и allowlist (Protomaps, pmtiles), а секреты заданы в панели Railway.
`
);
