<!-- Назначение файла: описание флагов cookie и схемы защиты от CSRF. -->

# Cookies & CSRF

Mini App использует заголовок `Authorization` и не хранит cookie. Admin UI применяет синхронизатор CSRF-токенов: запрос `GET /api/v1/csrf` выдаёт токен и устанавливает защищённые cookie (`HttpOnly`, `Secure`, `SameSite=None`). Флаг `Secure` включён всегда; отключить его можно только переменной окружения `COOKIE_SECURE=false` для локальной отладки. Токен запрашивается при входе и при фокусе вкладки, что обеспечивает его ротацию.

Маршруты мини-приложения с префиксом `/api/tma` и запросы с заголовком `Authorization` исключены из проверки CSRF. При отсутствии или несовпадении токена сервер отвечает `403` с телом в формате `application/problem+json`.

Лимитер запросов использует `telegram_id` пользователя. При необходимости можно указать заголовок `X-Captcha-Token` со значением переменной `CAPTCHA_TOKEN`, чтобы обойти ограничение.

Для staged rollout Admin UI может работать в bearer-режиме (`VITE_AUTH_BEARER_ENABLED=true`) вместе с `httpOnly` refresh-cookie. В этом режиме клиент отправляет `Authorization: Bearer <accessToken>`, а обновление access выполняется через `/api/v1/auth/refresh` без хранения access-токена в `localStorage`.

## Troubleshooting `/api/v1/auth/refresh`

Если в логах есть смесь `200/401/403` по refresh-эндпоинту, проверяйте связку метрик, а не только HTTP-логи:

- `401` для `/api/v1/auth/refresh` обычно означает невалидный/просроченный refresh-cookie.
- `403` для `/api/v1/auth/refresh` обычно совпадает с ростом `auth_csrf_errors_total` и указывает на проблему CSRF (пропущен `X-XSRF-TOKEN`, устаревший токен, несогласованный домен cookie).
- Подтверждайте через `api_errors_total{path="/api/v1/auth/refresh",status="401"}` и `auth_csrf_errors_total{path="/api/v1/auth/refresh"}`.

Быстрая проверка на проде:

1. Убедиться, что перед refresh выполняется `GET /api/v1/csrf` и клиент отправляет актуальный `X-XSRF-TOKEN`.
2. Проверить `COOKIE_DOMAIN`, `COOKIE_SECURE`, `SameSite=None` и HTTPS-терминацию на edge.
3. Сверить, что в bearer-режиме фронт не удаляет refresh-cookie и не смешивает legacy cookie-flow с Authorization-flow в одном запросе.
