# ERM Telegram Web Bot

Монорепозиторий системы управления задачами и ресурсами предприятия:

- `apps/api` — REST API, Telegram runtime, RBAC, обработка файлов.
- `apps/web` — веб-интерфейс (Vite + React).
- `apps/worker` — фоновые очереди BullMQ (геокодинг/маршруты/сервисные jobs).
- `packages/shared`, `packages/utils` — общие типы и утилиты.

## Быстрый старт

### Требования

- Node.js 20+
- pnpm 10+
- MongoDB
- Redis (для фоновых очередей)

### Установка

```bash
pnpm install
cp .env.example .env
```

Заполните переменные в `.env`, затем:

```bash
pnpm dev
```

Команда запускает приложения монорепозитория через Turbo.

## Основные команды

```bash
pnpm build        # сборка всех пакетов и приложений
pnpm lint         # линтинг
pnpm typecheck    # проверка TypeScript
pnpm test         # тесты
pnpm check        # быстрый CI-набор
pnpm check:full   # полный CI-набор
pnpm run docs:audit
```

## Документация

Канонический список поддерживаемых документов ведётся только в [`docs/index.md`](docs/index.md). Ниже оставлены только актуальные entry points без отдельных списков и historical-материалов.

- Точка входа в документацию: [`docs/README.md`](docs/README.md)
- Канонический индекс и статусы документов: [`docs/index.md`](docs/index.md)
- Технический мануал: [`docs/technical_manual.md`](docs/technical_manual.md)
- Архитектурный обзор: [`docs/architecture.md`](docs/architecture.md)
- Безопасность: [`SECURITY.md`](SECURITY.md), [`INCIDENT_RESPONSE.md`](INCIDENT_RESPONSE.md)

Актуальные runbook-материалы, supporting docs и архив перечислены из одного места в [`docs/index.md`](docs/index.md) и доступны через [`docs/README.md`](docs/README.md).

## Правила для ассистентов

Единственные источники правил для AI-ассистентов:

- [`AGENTS.md`](AGENTS.md)
- [`.openai/assistant_instructions.json`](.openai/assistant_instructions.json)

Остальная документация не должна дублировать или переопределять эти правила.

## Разворачивание коротких Google Maps ссылок (`/api/v1/maps/expand`)

Маршрут `/api/v1/maps/expand` умеет раскрывать короткие ссылки Google Maps и возвращать `url`, `coords` и `place`.
Подробная runtime-настройка fallback через Playwright, переменных `MAPS_HEADLESS_FALLBACK=playwright` и `MAPS_HEADLESS_TIMEOUT_MS` вынесена в [`docs/technical_manual.md`](docs/technical_manual.md#api-headless-fallback-для-google-maps-expand).
