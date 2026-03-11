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
```

## Документация

- Точка входа: [`docs/README.md`](docs/README.md)
- Единый индекс: [`docs/index.md`](docs/index.md)
- Техническое руководство: [`docs/technical_manual.md`](docs/technical_manual.md)
- Архитектура: [`docs/architecture.md`](docs/architecture.md)
- Права и роли: [`docs/permissions.md`](docs/permissions.md)
- Безопасность: [`SECURITY.md`](SECURITY.md), [`INCIDENT_RESPONSE.md`](INCIDENT_RESPONSE.md)

## Правила для ассистентов

Единственные источники правил для AI-ассистентов:

- [`AGENTS.md`](AGENTS.md)
- [`.openai/assistant_instructions.json`](.openai/assistant_instructions.json)

Остальная документация не должна дублировать или переопределять эти правила.

## Разворачивание коротких Google Maps ссылок (`/api/v1/maps/expand`)

Для URL вида `https://maps.app.goo.gl/...` обычный серверный `fetch` может не получить финальную ссылку с координатами.
В API предусмотрен headless-fallback через Playwright (`extractCoordsViaPlaywright`).

1. Убедитесь, что пакет `playwright` установлен (в workspace зависимостях).
2. Включите fallback переменной окружения:

```bash
MAPS_HEADLESS_FALLBACK=playwright
```

3. При необходимости увеличьте таймаут рендера страницы:

```bash
MAPS_HEADLESS_TIMEOUT_MS=12000
```

Допустимый диапазон `MAPS_HEADLESS_TIMEOUT_MS`: `1000..20000` мс (по умолчанию `8000`).
После перезапуска сервиса маршрут `/api/v1/maps/expand` сможет раскрывать короткие ссылки и возвращать `url`, `coords` и `place` при успешном извлечении.
