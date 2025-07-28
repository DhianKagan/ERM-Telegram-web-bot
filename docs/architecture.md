<!-- Назначение файла: обзор архитектуры и модулей проекта (Auth, Tasks, Users, Roles, Logs). -->

# Архитектура

Проект разделён на серверную часть и веб‑клиент в каталоге `bot`.

- `src/api` — HTTP API на Express c подключением Swagger и rate limit.
- `src/bot` — бот на Telegraf и планировщик напоминаний.
- `src/routes` — роутеры REST API.
- `src/services` — работа с Telegram API, MongoDB и вспомогательные утилиты.
- `src/models` и `src/db` — схемы Mongoose и подключение к базе.
- `web` — клиентское приложение React и контексты состояний.

Модули связаны через сервисы и разделены по ответственности, что упрощает тестирование и расширение функциональности.
Поле `access` модели пользователя хранит числовую маску для быстрой проверки прав.

## Модульная структура

- **Auth** — обработка входа и выдача токенов. Основные файлы: `auth.controller.ts`, `auth.service.ts`, `auth.dto.ts`.
- **Tasks** — создание и изменение задач. Основные файлы: `tasks.controller.ts`, `tasks.service.ts`, `tasks.dto.ts`.
- **Users** — управление пользователями. Основные файлы: `users.controller.ts`, `users.service.ts`, `users.dto.ts`.
- **Roles** — описание ролей и прав. Основные файлы: `roles.controller.ts`, `roles.service.ts`, `roles.dto.ts`.
- **Logs** — запись и просмотр логов. Основные файлы: `logs.controller.ts`, `logs.service.ts`, `logs.dto.ts`.
