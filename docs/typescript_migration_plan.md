<!-- Назначение файла: план миграции JavaScript в TypeScript, основные модули: bot, web. -->

# План миграции на TypeScript

## Инвентаризация JS-файлов

| Каталог                      | Количество |
| ---------------------------- | ---------- |
| `bot/src`                    | 45         |
| `bot/web`                    | 24         |
| `bot/tests`                  | 46         |
| `scripts` и корневые конфиги | 13         |

Переведены на TypeScript: `userLink`, `formatTask`, `validate`, `haversine`, `verifyInitData`, `accessMask`, `formatUser`, `setTokenCookie`, `rateLimiter`, `parseJwt`, `csrfToken` и `extractCoords`.
Переведены сервис, контроллер и роут карт.

### Высокий приоритет — сервер `bot/src`

- `bot`: bot.js
- `controllers`: maps.js, optimizer.js, routes.js
- `middleware`: taskAccess.js, checkRole.js
- `services`: messageQueue.ts, userInfoService.ts, tasks.ts, route.ts, maps.ts, scheduler.ts, wgLogEngine.ts, optimizer.ts, telegramApi.ts, service.ts, otp.ts, routes.ts
- `routes`: tasks.js, route.js, authUser.js, maps.js, users.js, optimizer.js, logs.js, roles.js, routes.js
- `api`: middleware.js, swagger.js, api.js
- `прочее`: models/User.js, admin/customAdmin.js, config.js

### Средний приоритет

- Клиент `bot/web`: утилиты и сервисы (tasks.js, route.js, maps.js, optimizer.js, osrm.js)
- Тесты `bot/tests`: 46 файлов

### Низкий приоритет

- Скрипты в `scripts/` и конфигурационные файлы (`babel.config.js`, `ecosystem.config.cjs`, `.prettierrc.cjs`, `eslint.config.js`)

## Этапы

1. Перевести файлы из `bot/src` на TypeScript, добавить типы входных данных и возврата.
2. После миграции серверного кода обновить тесты и клиентские модули.
3. Удалить `allowJs` и включить `noImplicitAny`, устранив оставшиеся `any`.
4. После перевода включить проверку отсутствия `.js` через ESLint.
5. Провести ревью архитектуры и внедрить проверки, исключающие возврат к JavaScript.
