# Настройка VS Code для локальной разработки и тестов

Назначение: шаги для подготовки окружения на локальной машине (VS Code или любой терминал) с упором на сборку, e2e и Lighthouse.

## Требования

- Node.js 20+ и включённый corepack (`corepack enable`).
- pnpm 10 (устанавливается corepack'ом автоматически).
- Git и bash (для Windows удобнее WSL2/Ubuntu).
- Свободные 6–8 ГБ диска для Chromium/Firefox Playwright.

## Быстрая подготовка в терминале VS Code

Откройте репозиторий в VS Code и выполните в встроенном терминале:

```bash
corepack enable
pnpm install --frozen-lockfile || pnpm install
./scripts/create_env_from_exports.sh # создаёт .env, если его нет
pnpm dlx playwright install --with-deps chromium firefox
pnpm --filter web run build:dist
pnpm pretest:e2e        # проверка playwright doctor и установка браузеров, если их нет
```

Если на Linux не стоят системные библиотеки для браузеров, запустите `pnpm dlx playwright install-deps chromium firefox`.

## Запуск e2e из VS Code

1. Запустите API с in-memory MongoDB: `./scripts/start_api_with_memdb.sh`.
2. Во втором терминале выполните `pnpm test:e2e` (используются конфиги из `tests/e2e`).
3. Для отдельных сценариев укажите проект браузера: `pnpm test:e2e -- --project=chromium --grep="контраст"`.

## Запуск Lighthouse локально

```bash
pnpm --dir apps/web build
pnpm dlx lhci autorun --upload.target=filesystem
```

Токен `LHCI_GITHUB_APP_TOKEN` не требуется для локального прогона; отчёт будет сохранён в каталоге `.lighthouseci`.

## Распространённые проблемы

- «command not found pnpm» — выполните `corepack enable` и перезапустите терминал.
- Ошибки сборки `sharp`/`esbuild` — запустите `pnpm rebuild` в корне.
- Playwright не находит браузер — повторите `pnpm pretest:e2e` или `pnpm dlx playwright install --with-deps chromium firefox`.
- Нет доступа к порту 5173/3000 — завершите старые процессы (`lsof -i :3000`) или смените порт через переменную `PORT`.
