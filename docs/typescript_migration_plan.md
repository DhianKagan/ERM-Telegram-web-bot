<!-- Назначение файла: план миграции JavaScript в TypeScript, основные модули: api, web. -->

# План миграции на TypeScript

## Инвентаризация JS-файлов

| Каталог                      | Количество |
| ---------------------------- | ---------- |
| `apps/api/src`               | 0          |
| `apps/web`                   | 1          |
| `apps/api/tests`             | 0          |
| `scripts` и корневые конфиги | 3          |

Переведены на TypeScript: `userLink`, `formatTask`, `validate`, `haversine`, `verifyInitData`, `accessMask`, `formatUser`, `setTokenCookie`, `rateLimiter`, `parseJwt`, `csrfToken`, `extractCoords` и `parseGoogleAddress`.
Сервисы и утилита `authFetch` веб-клиента (`logs`, `optimizer`, `roles`, `route`, `routes`, `tasks`, `osrm`) переписаны на TypeScript.

Серверный и клиентский код переведены на TypeScript; остались лишь конфигурационные файлы.
Сервисы логов и пользователей используют интерфейсы репозитория без `any`.
Запросы MongoDB и движок логов типизированы без `any`,
правило ESLint `@typescript-eslint/no-explicit-any` включено для серверного кода.
ESLint также запрещает файлы `.js` за исключением конфигурационных.

### Высокий приоритет — строгая типизация

- Включён `noImplicitAny` в `tsconfig.json`.
- Типы модели задач и сервисов уточнены.

### Средний приоритет

- Перевести оставшиеся конфигурационные файлы на TypeScript при необходимости.

## Этапы

1. Перевести файлы из `apps/api/src` на TypeScript, добавить типы входных данных и возврата.
2. После миграции серверного кода обновить тесты и клиентские модули.
3. Включить `noImplicitAny`, устранив оставшиеся `any`.
4. Провести ревью архитектуры и внедрить проверки, исключающие возврат к JavaScript.
