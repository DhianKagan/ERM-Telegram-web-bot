<!-- Назначение файла: план миграции JavaScript в TypeScript, основные модули: bot, web. -->

# План миграции на TypeScript

## Инвентаризация JS-файлов

| Каталог                      | Количество |
| ---------------------------- | ---------- |
| `bot/src`                    | 0          |
| `bot/web`                    | 1          |
| `bot/tests`                  | 0          |
| `scripts` и корневые конфиги | 3          |

Переведены на TypeScript: `userLink`, `formatTask`, `validate`, `haversine`, `verifyInitData`, `accessMask`, `formatUser`, `setTokenCookie`, `rateLimiter`, `parseJwt`, `csrfToken`, `extractCoords` и `parseGoogleAddress`.
Сервисы и утилита `authFetch` веб-клиента (`logs`, `maps`, `optimizer`, `roles`, `route`, `routes`, `tasks`, `osrm`) переписаны на TypeScript.
Переведены сервис, контроллер и роут карт.

Серверный и клиентский код переведены на TypeScript; остались лишь конфигурационные файлы.

### Высокий приоритет — строгая типизация

- Включён `noImplicitAny` в `tsconfig.json`.
- Уточнить типы в модели задач и сервисах.

### Средний приоритет

- Перевести оставшиеся конфигурационные файлы на TypeScript при необходимости.

## Этапы

1. Перевести файлы из `bot/src` на TypeScript, добавить типы входных данных и возврата.
2. После миграции серверного кода обновить тесты и клиентские модули.
3. Включить `noImplicitAny`, устранив оставшиеся `any`.
4. После перевода включить проверку отсутствия `.js` через ESLint.
5. Провести ревью архитектуры и внедрить проверки, исключающие возврат к JavaScript.
