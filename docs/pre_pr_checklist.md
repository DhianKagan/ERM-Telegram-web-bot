<!-- Назначение файла: чек-лист обязательных проверок перед Pull Request. Основные модули: scripts, tests, ci. -->

# Чек-лист проверок перед Pull Request

Этот документ собирает в одном месте все команды, которые нужно выполнить перед публикацией ветки и открытием пулл-реквеста. Команды сгруппированы по этапам, но их удобно запускать последовательно сверху вниз.

## 1. Подготовка окружения

| Команда | Назначение | Примечание |
| --- | --- | --- |
| `./scripts/create_env_from_exports.sh` | Создать `.env` из экспортов, если файла ещё нет | Скрипт наполняет обязательные переменные и не перезаписывает существующие значения |
| `./scripts/install_bot_deps.sh` | Установить корневые, серверные и клиентские зависимости | Включает резервное скачивание pnpm при сбоях corepack и npm |
| `pnpm install --frozen-lockfile` | Синхронизировать lock-файл и локальные модули | При ошибках повторите без `--frozen-lockfile` |
| `pnpm install --dir apps/api --frozen-lockfile` | Установить зависимости API | Повторите без `--frozen-lockfile`, если появляются peer-ошибки |
| `pnpm install --dir apps/web --frozen-lockfile` | Установить зависимости клиента |  |

## 2. Аудит и технические проверки

| Команда | Назначение | Примечание |
| --- | --- | --- |
| `./scripts/audit_deps.sh` | Проверить зависимости через `audit-ci` | Разрешённые исключения описаны в `audit-ci.json` |
| `pnpm approve-builds` | Контроль разрешённых `postinstall`-скриптов | CI падает при появлении новых скриптов |
| `pnpm size` | Контроль размера JS-бандлов | Проверяет `apps/api/public/js/index-*.js` |
| `pnpm a11y` | Проверка контрастности и доступности | Использует `vite preview` и `@axe-core/cli` |
| `pnpm format` | Автоматическое форматирование | Убедитесь, что git не показывает новых диффов |
| `pnpm lint` | Линтеры фронтенда и бэкенда | Эквивалентно `pnpm lint:api` и `pnpm lint:web` |
| `docker compose config` | Проверка конфигурации Docker | Команда опциональна, если Docker недоступен |

## 3. Тесты

| Команда | Назначение | Примечание |
| --- | --- | --- |
| `pnpm test:unit` | Юнит-тесты пакетов и клиента | Использует Jest и Vitest |
| `pnpm test:api` | Интеграционные тесты API | Включает Supertest и MongoMemoryServer |
| `pnpm pretest:e2e` | Подготовка браузеров Playwright и диагностика | Ставит Firefox/Chromium и запускает `playwright doctor`/`--list` |
| `pnpm test:e2e` | E2E-тесты Playwright (`chromium`, `firefox`, `webkit`) | Можно запускать с `--project=<name>` |
| `./scripts/setup_and_test.sh` | Комплексная проверка перед коммитом | Объединяет установку зависимостей, Jest, линтеры и стресс-тест |

## 4. Сборка и ручная проверка

| Команда | Назначение | Примечание |
| --- | --- | --- |
| `pnpm build` | Сборка монорепозитория | Компилирует `ensureDefaults` и собирает клиент |
| `pnpm -r build` | Сборка всех пакетов | Эквивалентна шагу CI `lint-test-build` |
| `./scripts/pre_pr_check.sh` | Проверка запуска API с MongoDB в памяти | Автоматически генерирует `SESSION_SECRET`, повторяет сборку и сохраняет лог `/tmp/apps/api_start.log` |
| `./scripts/build_with_tmp.sh` | Сборка для e2e-тестов во временном каталоге | Исключает гонки при параллельных процессах |

## 5. Дополнительные действия перед публикацией PR

- Убедитесь, что токен Lighthouse CI (`LHCI_GITHUB_APP_TOKEN`) активен — статусы появятся в GitHub только после успешного локального прогона.
- Запустите `pnpm run dev` и вручную проверьте основные пользовательские сценарии (логин, создание задачи, загрузка вложений).
- Обновите документацию: `README.md`, `CHANGELOG.md`, `ROADMAP.md` и связанные файлы, если поведение менялось.
- Перед пушем выполните `git status` и убедитесь, что не осталось временных файлов или незакоммиченных миграций.

## Быстрый запуск полного набора

```bash
./scripts/create_env_from_exports.sh
./scripts/install_bot_deps.sh
./scripts/setup_and_test.sh
pnpm build
pnpm size
pnpm a11y
pnpm approve-builds
pnpm pretest:e2e
pnpm test:e2e --project=chromium
./scripts/pre_pr_check.sh
```

## Что попадёт в CI

GitHub Actions повторяет ключевые шаги чек-листа:

- `audit-deps`: запускает `./scripts/audit_deps.sh` после `install_bot_deps.sh`.
- `lint-test-build`: выполняет `pnpm approve-builds`, `pnpm lint`, `pnpm test:unit`, `pnpm test:api`, `pnpm -r build`, `pnpm size` и сохраняет артефакты.
- `e2e-tests`: запускает Playwright-тесты для `chromium`, `firefox` и `webkit` после подготовки браузеров.

Если локальные проверки завершаются без ошибок, статусы PR совпадут с результатами этого чек-листа.
