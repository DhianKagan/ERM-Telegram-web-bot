<!-- Назначение файла: инструкции для разработчиков. -->

# 🧠 Инструкции для Codex

## Стиль и архитектура

- Документация и комментарии пишутся только по‑русски.
- В начале каждого файла указывайте назначение и основные модули.
- Код делайте лаконичным и понятным.
- Сборка TypeScript работает в строгом режиме; флаг `noImplicitAny` включён.
- Сборка клиента Vite очищает каталог вывода через `emptyOutDir`.
- Dockerfile кеширует зависимости через `pnpm fetch` и собирает пакеты командой `pnpm build`; перед `pnpm fetch` копируется каталог `patches`.
- При запуске образа Docker `ensureDefaults` выполняется в `CMD`, токен `BOT_TOKEN` передаётся через переменную окружения.
- Railway использует Nixpacks с `nixpacks.toml`, установка зависимостей выполняется без режима offline.
- Procfile запускает `pnpm build` перед `pm2-runtime`, `Procfile.railway` содержит шаг `release: pnpm build`.
- Текстовые сообщения бота в `apps/api/src/messages.ts` должны быть на русском.
- Контексты React держите в отдельных файлах, провайдеры экспортируйте из этих файлов.
- AuthContext содержит только профиль и флаг загрузки; JWT не сохраняется на клиенте.
- Таблицы используют `DataTable` на основе `@tanstack/react-table`, а колонки описываются в `apps/web/src/columns`.
- Раздел архива задач `/cp/archive` использует API `/api/v1/archives`; просмотр доступен маске 6, полное удаление — только при маске 8.
- Фильтры таблиц выводят списки значений с чекбоксами, поиск выполняется кнопкой «Искать».
- Логирование сохраняет изменения задач, профиля, вход и операции с файлами; обращения к `/api/v1/logs` не записываются.
- Обновление статуса задачи выполняется PATCH `/api/v1/tasks/:id/status`.
- API содержит CRUD‑роуты для флотов, департаментов, сотрудников и коллекций.
- Роль admin включает права manager через объединение масок.
- Коллекция CollectionItem использует индексы `type_name_unique` и `search_text`; индексы создаёт `scripts/db/ensureIndexes.ts`.
- Глобальный лимитер подключается на префикс `/api`; статические файлы отдавайте с `Cache-Control: public, max-age=31536000, immutable`.
- Поля задач могут содержать объект `custom`; формы должны рендерить такие поля динамически.
- Формы задач включают поле `formVersion`; сервер отклоняет неизвестные версии.
- История изменений задач хранится в поле `history` и выводится в форме.
- Антивирус по умолчанию работает в сигнатурном режиме (`ANTIVIRUS_VENDOR=signature`); для подключения демона ClamAV выставляйте `ANTIVIRUS_VENDOR=clamav` и настройки хоста.
- Tailwind использует плагин `@tailwindcss/forms`; базовые компоненты `Button` и `Input` следуют 8‑pt ритму и выделяют фокус кольцом.
- Контраст интерфейса не ниже 4.5:1, проверка реализована тестом `tests/e2e/contrast.spec.ts`.
- К файлам в форме можно добавить миниатюры; загрузка доступна только при заполненном названии.
- Вложения загружаются через drag-and-drop компонент, сервер поддерживает chunk-upload.
- Канбан-доска находится в `/cp/kanban` и доступна только администраторам; страница «Мои задачи» удалена, пользователи видят только доступные им задачи и могут менять статус на «В работе» или «Выполнена».
- SPA обслуживается маршрутами `app.get('/')` и `app.get('*')`, обеспечивая корректный переход на `/login`.
- Веб‑клиент работает и в браузере, и в Telegram; отсутствие Telegram не вызывает предупреждений.
- Шрифты хранятся локально в `apps/web/public/fonts`, загрузка через `scripts/download-fonts.sh`.
- SRI рассчитывается только для локальных ресурсов, внешние URL пропускаются.
- Hero-изображения генерируются скриптом `scripts/generate_hero_images.mjs`, каталог `apps/web/public/hero` не коммитится.

## Качество и тесты

- Пакетный менеджер — `pnpm`, файлы `package-lock.json` не используем.
- `install_bot_deps.sh` скачивает pnpm через curl или GitHub при сбоях corepack и npm.
- `.npmrc` перенаправляет scope `@jsr` на npmjs.org, чтобы установка зависимостей не требовала токена.
- Перед коммитом запускайте `./scripts/setup_and_test.sh`.
  - Для e2e-тестов сборку выполняйте через `scripts/build_with_tmp.sh`,
    чтобы процессы не делили `apps/api/public/js`.
- Скрипт `pretest:e2e` устанавливает Firefox и Chromium и запускает `playwright doctor`
  с запасным вызовом `playwright install --list`; не удаляйте диагностический шаг.
- Перед пулл-реквестом выполняйте `./scripts/pre_pr_check.sh`, он создаёт `.env` из `.env.example`, проверяет сборку и запуск бота, автоматически исправляя ошибки и повторяя до успеха, запускает аудит зависимостей и записывает лог в `/tmp/apps/api_start.log`.
- Lighthouse CI использует GitHub App, токен хранится в секрете `LHCI_GITHUB_APP_TOKEN`, отчёты размещаются во временном публичном хранилище.
- Скрипт `pre_pr_check.sh` поднимает MongoDB в памяти; `scripts/check_mongo.mjs` пропускает проверку при `CI=true`.
- `pnpm run dev` устанавливает `PNPM_SCRIPT_TIMEOUT=0`, чтобы серверы не завершались через 10 минут.
- При необходимости проверяйте зависимости вручную командой `./scripts/audit_deps.sh` (использует `audit-ci` и пропускает слабые уязвимости `--audit-level high`).
- Dependabot еженедельно обновляет npm-зависимости, для PR по безопасности используйте шаблон `Security Update`.
- При отсутствии `.env` используйте `./scripts/create_env_from_exports.sh`.
- Для локального запуска API с MongoDB в памяти используйте `./scripts/start_api_with_memdb.sh`.
- Если доступна команда `docker` и есть `docker-compose.yml`, выполняйте `docker compose config`.
- Настроен Prettier, используйте `pnpm format` перед коммитами.
- Линтер запускайте `pnpm lint`.
  - Сборка клиента проверяется `pnpm size`; файлы `index-*.js` в `apps/api/public/js` меньше 900 KB.
- Скрипты зависимостей проверяются `pnpm approve-builds`, CI падает при появлении новых скриптов.
- Статическую страницу `apps/web/index.html` проверяйте на контраст командой `pnpm a11y` через `@axe-core/cli` и `vite preview`.
- Сценарии Playwright и Supertest находятся в каталоге `tests` и запускаются командами `pnpm test:e2e` и `pnpm test:api`.
- Индексы MongoDB создавайте скриптом `scripts/db/ensureIndexes.ts`.
- Для корректного разрешения модулей установлен `reflect-metadata` в корневых зависимостях.

## Документация

- Все технические файлы сведены в `docs/technical_manual.md`.
- Руководство по настройке Telegram-бота включено туда.
- README упрощён; подробные сведения перенесены в docs/technical_manual.md.
- Документация по модулям находится в `docs/architecture.md`.
- Документация по безопасности — в `docs/security/cookies_csrf.md`.
- Документация по маскам доступа и ролям — в `docs/permissions.md`.
- Миграция `scripts/db/addManagerRole.ts` добавляет роль manager в существующие базы;
  запуск описан в `docs/permissions.md`.
- FAQ для саппорта — в `docs/support_faq.md`.
- Устаревшие материалы перенесены в `docs/archive`.
- При изменениях обновляйте `README.md`, `CHANGELOG.md`, `ROADMAP.md` и `AGENTS.md`.
- `.env.example` использует подключение `mongodb://admin:admin@localhost:27017/ermdb?authSource=admin`.
- `SESSION_SECRET` в `.env.example` пуст; создайте его через `./scripts/create_env_from_exports.sh` или `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`, `.env` не коммитим.
- Страница «Настройки» содержит вкладки departments, divisions, roles, employees и fleets; слева список с поиском и пагинацией, справа форма {name,value};
  переменная `VITE_COLLECTIONS_READY` больше не используется.
- Переменная `STORAGE_DIR` задаёт базовый каталог статических файлов и вложений (по умолчанию `apps/api/public`).
- Рекомендуется проверять базу командой `pnpm --dir bot check:mongo`.
- Переменная `BOT_API_URL` позволяет использовать локальный `telegram-bot-api`.
- Переменная `COOKIE_SECURE=false` отключает флаг `Secure` у cookie, используйте только локально.
- Docker Compose содержит healthcheck для MongoDB.
- Наблюдаемость: гистограммы HTTP, метрики OSRM и заголовок `traceparent` для трассировки.
- Лимитер отправляет заголовки `X-RateLimit-*`, метрика `rate_limit_drops_total` содержит метки `name` и `key`.
- Управление файлами выполняется через `/api/v1/storage`, раздел `/cp/storage` отображает список вложений.
- Коллекция `File` хранит taskId, userId, name, path, type, size и uploadedAt; сервис `dataStorage` читает из MongoDB, фильтрует по `userId` и `type` и при удалении чистит задачу.
- Скачивание файлов выполняется через авторизованный роут `/api/v1/files/:id`; свободное место отслеживается метрикой `disk_free_bytes` и при нехватке отправляется предупреждение администраторам.
- Секреты загружаются из HashiCorp Vault или AWS Secrets Manager,
  ключи пересоздаются по `KEY_ROTATION_CRON`.
- Ключ лимитера строится по `telegram_id`; верная капча в заголовке `X-Captcha-Token` обходится ограничение.
- Запросы OSRM кешируются на 10 минут, очищаются при изменении задач;
  переменные `ROUTE_CACHE_ENABLED` и `ROUTE_CACHE_TTL` управляют кешом.
- Ограничение `/table` контролируется переменными `ROUTE_TABLE_GUARD`,
  `ROUTE_TABLE_MAX_POINTS` и `ROUTE_TABLE_MIN_INTERVAL_MS`.
- Стресс-план описан в `docs/stress_plan.md`.
- План внедрения улучшений описан в `docs/apply_analysis_plan.md`.
