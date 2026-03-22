<!-- Назначение файла: политика безопасности, минимальный baseline и карта обязательных проверок. -->

# Security Policy

## Supported versions

Проект поддерживается в рамках актуальной ветки `main`.

| Version          | Supported      |
| ---------------- | -------------- |
| main (latest)    | ✅             |
| legacy snapshots | ⚠️ best effort |

## Reporting a vulnerability

Если вы нашли уязвимость:

1. **Не публикуйте детали публично** до исправления.
2. Создайте приватное сообщение через GitHub Security Advisory (если доступно) или issue с минимальными деталями без PoC/секретов.
3. При необходимости продублируйте сообщение maintainers репозитория.

Мы подтверждаем получение отчёта и согласуем дальнейший процесс исправления.

## Минимальные требования безопасности

- Не хранить секреты в репозитории.
- Использовать переменные окружения для токенов/ключей.
- Хранить JWT в защищённых cookie (`HttpOnly`, `Secure`, `SameSite`).
- Проводить проверку прав доступа (RBAC) на серверной стороне.

## Обязательные проверки безопасности на PR / release

| Практика               | Владелец                                | Триггер                                                                                                                        | Evidence of completion                                                                                                                                      | Статус автоматизации                                                                                                                                           |
| ---------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Аудит зависимостей     | Maintainer PR / Release manager         | Каждый PR с изменением `package.json`, `pnpm-lock.yaml`, Docker/runtime-образа; каждый release                                 | Ссылка на успешный CI run или лог ручного `./scripts/audit_deps.sh`; при исключении — diff `audit-ci.json` + ссылка на GHSA/CVE                             | Частично: workflow `Codex Quality Gate` декларирует `pnpm run audit`, но root-script пока не подключён; ручной канонический запуск — `./scripts/audit_deps.sh` |
| CSRF / cookie flags    | API owner                               | Любой PR, затрагивающий auth, middleware, reverse proxy, env `COOKIE_*`, `VITE_AUTH_BEARER_ENABLED`                            | Тесты/лог проверки `GET /api/v1/csrf`, `Set-Cookie`, `403` без `X-XSRF-TOKEN`; ссылка на runbook `docs/security/cookies_csrf.md`                            | Частично: есть тесты и security-lint intent в CI, но root-script `pnpm lint:security` пока не подключён                                                        |
| CSP                    | Web owner + API owner                   | Любой PR с новыми внешними доменами, script/style/img/connect источниками, embed/analytics                                     | Diff allowlist/env, подтверждение `Content-Security-Policy(-Report-Only)` header, отсутствие необъяснённых violation reports                                | Документировано; отдельной CI-проверки сейчас нет                                                                                                              |
| Secrets hygiene        | Author PR + Maintainer                  | Каждый PR/release, особенно при изменении CI, deploy, `.env.example`, интеграций и webhook/SDK                                 | Проверка diff на отсутствие секретов, подтверждение что секреты хранятся только в GitHub/Railway secrets; при ротации — запись в incident ticket/postmortem | Документировано; отдельного secret-scanning workflow в репозитории сейчас нет                                                                                  |
| Incident response path | Incident commander / Maintainer on duty | Любой подтверждённый security incident, компрометация токена, секретов, cookie-domain, supply-chain alert уровня high/critical | Incident ticket, отметка о ротации/деплое, ссылка на `INCIDENT_RESPONSE.md`, postmortem / changelog записи                                                  | Документировано; запускается вручную по триггеру                                                                                                               |

## Канонические документы

- Runbook реагирования: [`INCIDENT_RESPONSE.md`](INCIDENT_RESPONSE.md)
- Cookies / CSRF: [`docs/security/cookies_csrf.md`](docs/security/cookies_csrf.md)
- CSP: [`docs/security/csp.md`](docs/security/csp.md)
- Dependabot / dependency PR: [`docs/security/dependabot_prs.md`](docs/security/dependabot_prs.md)
- Ложные срабатывания dependency audit: [`docs/security/audit_ci_false_positives.md`](docs/security/audit_ci_false_positives.md)
- Документация RBAC: [`docs/permissions.md`](docs/permissions.md)
