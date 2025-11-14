# Repo Map (шпаргалка)

Обновлено: 2025-11-10T12:27:03.964Z

## Корень / CI / Инфра

- Workflows: `.github/workflows/ci.yml, codeql.yml, codex-quality.yml, danger.yml, docker.yml, lighthouse.yml, refresh-addresses.yml, release.yml`
- Env-шаблоны: `./.env.example`, `./Railway/.env`
- Патчи: `patch_cjs/*`
- Semgrep: `./semgrep/`
- Prometheus: `./prometheus/`
- Railway: `./Railway/{analysis,config,logs}`

## Backend (apps/api)

- Точки мидлвар/роутинга/аутентификации:
  - JWT/логгер/заголовки — `apps/api/src/api/middleware.ts`
  - Роуты/CORS/CSRF — `apps/api/src/api/routes.ts`
  - Ошибки/метрики — `apps/api/src/middleware/errorMiddleware.ts`
  - Auth/guards — `apps/api/src/auth/*`, `roles.guard.ts`, `tmaAuth.guard.ts`
- Конфигурация:
  - JWT_SECRET — `apps/api/src/config.ts`
  - Примеры env — `apps/api/.env.local`, `.env.local.example`
- Бот/TMA:
  - `apps/api/src/bot/bot.ts`, `apps/api/src/bot/runtime.ts`

## Frontend (apps/web)

- Сборка/вход: `apps/web/vite.config.ts`, `apps/web/src/main.tsx`, `apps/web/index.html`
- Env: `apps/web/.env`, `.env.example`

## Shared / Scripts / Tests

- Shared: `packages/shared/`
- Scripts: `scripts/ci/*`, `scripts/db/*`, `scripts/railway/*`, `scripts/run_security_lint.sh`
- Tests: `tests/api`, `tests/e2e`, `tests/playwright`, `tests/fixtures`, `tests/stubs`, `tests/railway`

---

## Горячие точки (JWT / CSRF / CORS / TMA)

**JWT** — секрет в env, верификация в `apps/api/src/api/middleware.ts`.

**CSRF** — `lusca.csrf({ angular: true, cookie: { ... } })` в `routes.ts`. Endpoints-исключения: `/api/v1/csrf`, префикс `/api/tma`. Метрики ошибок в `errorMiddleware.ts`.

**CORS** — заменить глобальное `app.use(cors())` на allowlist + `credentials:true` + заголовки `X-XSRF-TOKEN`/Authorization.

**TMA/Telegram** — guards в `apps/api/src/auth/tmaAuth.guard.ts`, логика бота в `apps/api/src/bot/*.ts`.

---

## Снапшоты (быстрый старт)

- Bash: `scripts/repo-snapshot.sh` → создаёт `repo_snapshot-YYYYMMDD-HHMM.txt` в корне.
- PowerShell: `scripts/repo-snapshot.ps1` → то же самое.

> Рекомендовано хранить последние 3–5 снапшотов и сжимать старые: `gzip -9 repo_snapshot-*.txt`.
