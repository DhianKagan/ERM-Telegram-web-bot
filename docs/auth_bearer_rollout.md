<!-- Назначение файла: план rollout bearer-auth для web + ops. -->

# Bearer auth rollout (C + D)

## Что меняется

- Frontend использует `Authorization: Bearer <accessToken>` для API-запросов.
- `accessToken` хранится только в памяти вкладки (не в localStorage).
- Обновление сессии выполняется через `POST /api/v1/auth/refresh` по `httpOnly` refresh-cookie.

## Переменные окружения

### API

- `AUTH_BEARER_ENABLED=true` — включает режим bearer-only для целевых роутов.
- `ACCESS_TOKEN_TTL` — TTL access токена (сек).
- `REFRESH_TOKEN_TTL` — TTL refresh токена (сек).
- `REFRESH_COOKIE_NAME` — имя refresh-cookie.
- `REFRESH_COOKIE_PATH` — path refresh-cookie.
- `REDIS_URL` — Redis для refresh store.

### Web

- `VITE_AUTH_BEARER_ENABLED=true` — включает bearer flow на клиенте.

## Рекомендуемый staged rollout

1. **Deploy API** с новым кодом, но `AUTH_BEARER_ENABLED=false`.
2. **Deploy web** с `VITE_AUTH_BEARER_ENABLED=true` в staging и прогон smoke:
   - login → protected request → refresh on 401.
3. Переключить `AUTH_BEARER_ENABLED=true` в staging.
4. После валидации включить флаг в production.
5. Держать legacy cookie/csrf-ветку как fallback на период стабилизации.

## Smoke-checklist

1. Проверить env parity в Railway перед деплоем: `AUTH_BEARER_ENABLED == VITE_AUTH_BEARER_ENABLED` (оба `true`/`1`).
2. Убедиться, что после обновления env пересобран/перезапущен сервис с web-сборкой. Если `api` и `web` разнесены — перезапустить **оба** (`api`, `web`); если это один Railway-сервис — достаточно одного redeploy/restart.
3. Открыть `/login`, пройти `send_code` + `verify_code`.
4. Проверить в DevTools Network, что `GET /api/v1/auth/profile` уходит с заголовком `Authorization: Bearer <accessToken>`.
5. Принудительно получить `401` (истёкший access), проверить автоматический `refresh`.
6. Выйти (`/api/v1/auth/logout`) и убедиться, что refresh-cookie очищен.

## Rollback

- На web: `VITE_AUTH_BEARER_ENABLED=false`.
- На API: `AUTH_BEARER_ENABLED=false`.
- После rollback клиент продолжит legacy cookie+csrf flow.
