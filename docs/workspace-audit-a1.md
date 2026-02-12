# Шаг A1 — аудит workspace и матрица пакетов

Дата аудита: 12 Feb 2026 (Europe/Kyiv)
Источник: `pnpm-workspace.yaml`, `package.json` в корне и в каждом workspace-пакете.

## Подтверждение структуры workspace

`pnpm-workspace.yaml` включает три зоны монорепозитория:

- `apps/*` — запускаемые сервисы/приложения.
- `packages/*` — переиспользуемые внутренние пакеты.
- `scripts` — отдельный workspace-пакет с инфраструктурными/CI-утилитами.

## Матрица пакетов

| Workspace path    | Package name | Тип     | Роль                                            | Зависимость от `shared`        |
| ----------------- | ------------ | ------- | ----------------------------------------------- | ------------------------------ |
| `apps/api`        | `apps/api`   | app     | REST API + Telegram bot runtime + бизнес-логика | Да (`"shared": "workspace:*"`) |
| `apps/web`        | `web`        | app     | Веб-клиент (Vite/React)                         | Да (`"shared": "workspace:*"`) |
| `apps/worker`     | `worker`     | app     | Фоновый воркер очередей                         | Да (`"shared": "workspace:*"`) |
| `packages/shared` | `shared`     | package | Общие типы/утилиты для приложений               | Нет (это целевой shared-пакет) |
| `scripts`         | `@erm/tools` | tools   | Служебные скрипты для CI/инфры                  | Нет                            |

## Вывод по шагу A1

- Workspace-структура (`apps/*`, `packages/*`, `scripts`) подтверждена.
- Все текущие приложения в `apps/*` уже используют `shared` через `workspace:*`.
- Бизнес-логика приложений в рамках шага A1 не изменялась.
