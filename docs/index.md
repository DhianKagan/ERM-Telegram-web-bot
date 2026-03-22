<!-- Назначение файла: единый индекс документации и статусов документов. -->

# Индекс документации

## 1) Назначение индекса

Файл фиксирует канонический набор документов, модель поддержки документации, полный реестр статусов `docs/**` и правила doc-audit перед релизом.

## 2) Канонический набор документов

Это единственное место, где перечислен поддерживаемый базовый набор документов проекта.

| Роль                      | Документ                                     | Статус    | Что обязано оставаться актуальным                                                    |
| ------------------------- | -------------------------------------------- | --------- | ------------------------------------------------------------------------------------ |
| Корневой обзор проекта    | [`../README.md`](../README.md)               | canonical | Верхнеуровневый обзор, быстрые команды, вход в docs                                  |
| Навигационный вход в docs | [`README.md`](README.md)                     | canonical | Человеко-ориентированная навигация без собственной «второй правды»                   |
| Индекс и policy docs      | [`index.md`](index.md)                       | canonical | Реестр канонических документов, статусы всех docs-материалов и правила doc-audit     |
| Технический мануал        | [`technical_manual.md`](technical_manual.md) | canonical | Runtime, настройка, troubleshooting, `/api/v1/maps/expand`, `MAPS_HEADLESS_FALLBACK` |
| Архитектурный обзор       | [`architecture.md`](architecture.md)         | canonical | Структура monorepo, runtime-слои и системные связи                                   |

## 3) Runbook / operational layer

Эти документы поддерживаются как актуальные operational/supporting материалы, но не заменяют канонический набор выше.

| Область                | Документ(ы)                                                                                                                                                                                                                                                                                                                                                                                                            | Статус  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Access / RBAC          | [`permissions.md`](permissions.md), [`access_mask.md`](access_mask.md)                                                                                                                                                                                                                                                                                                                                                 | runbook |
| Support / onboarding   | [`support_faq.md`](support_faq.md), [`vscode_local_setup.md`](vscode_local_setup.md), [`chat-task-template.md`](chat-task-template.md)                                                                                                                                                                                                                                                                                 | runbook |
| Recovery / reliability | [`queue_recovery_runbook.md`](queue_recovery_runbook.md), [`logistics_recovery_plan.md`](logistics_recovery_plan.md), [`stress_plan.md`](stress_plan.md)                                                                                                                                                                                                                                                               | runbook |
| Railway / deployment   | [`railway_full_setup.md`](railway_full_setup.md), [`railway_minimal_setup.md`](railway_minimal_setup.md), [`railway_split_services.md`](railway_split_services.md), [`railway_s3_setup.md`](railway_s3_setup.md), [`railway_logs.md`](railway_logs.md)                                                                                                                                                                 | runbook |
| Product / runtime      | [`auth_bearer_rollout.md`](auth_bearer_rollout.md), [`bot_responses.md`](bot_responses.md), [`modern_monitoring_stack.md`](modern_monitoring_stack.md), [`osrm.md`](osrm.md), [`security/cookies_csrf.md`](security/cookies_csrf.md), [`security/csp.md`](security/csp.md), [`security/dependabot_prs.md`](security/dependabot_prs.md), [`security/audit_ci_false_positives.md`](security/audit_ci_false_positives.md) | runbook |

## 4) Historical и archive policy

- `historical` — документы, сохранённые для контекста или evidence, но не описывающие текущий source-of-truth и не используемые как release/runbook база.
- `archive` — явно снятые с поддержки материалы, перенесённые в `docs/archive/` чтобы не создавать «вторую правду» рядом с актуальными entry points.
- Если документ описывает разовый аудит, исследование, старый rollout, завершённый план или внешний UI/infra snapshot, он должен быть `historical` или `archive`, а не `canonical`.

## 5) Полный реестр статусов документов

### Активные документы в `docs/`

| Документ                                                                                             | Статус     | Назначение                                                                   |
| ---------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------- |
| [`README.md`](README.md)                                                                             | canonical  | Навигационная точка входа в docs.                                            |
| [`index.md`](index.md)                                                                               | canonical  | Единый реестр canonical/runbook/historical/archive.                          |
| [`technical_manual.md`](technical_manual.md)                                                         | canonical  | Актуальный runtime-мануал и troubleshooting.                                 |
| [`architecture.md`](architecture.md)                                                                 | canonical  | Актуальная архитектура монорепозитория.                                      |
| [`permissions.md`](permissions.md)                                                                   | runbook    | Операционная документация по ролям и RBAC.                                   |
| [`access_mask.md`](access_mask.md)                                                                   | runbook    | Краткая памятка по access mask с ссылкой на `permissions.md`.                |
| [`auth_bearer_rollout.md`](auth_bearer_rollout.md)                                                   | runbook    | Текущий rollout bearer-auth и env-параметры.                                 |
| [`bot_responses.md`](bot_responses.md)                                                               | runbook    | Справочник типовых сообщений бота.                                           |
| [`chat-task-template.md`](chat-task-template.md)                                                     | runbook    | Шаблон постановки задач в чате для инженерной работы.                        |
| [`logistics_recovery_plan.md`](logistics_recovery_plan.md)                                           | runbook    | План восстановления и стабилизации логистического потока.                    |
| [`modern_monitoring_stack.md`](modern_monitoring_stack.md)                                           | runbook    | Практический мониторинговый overlay для локальной observability.             |
| [`osrm.md`](osrm.md)                                                                                 | runbook    | Инструкция по развёртыванию и подключению OSRM.                              |
| [`queue_recovery_runbook.md`](queue_recovery_runbook.md)                                             | runbook    | Диагностика и восстановление очередей BullMQ/DLQ.                            |
| [`railway_full_setup.md`](railway_full_setup.md)                                                     | runbook    | Полный Railway runbook.                                                      |
| [`railway_logs.md`](railway_logs.md)                                                                 | runbook    | Сбор и анализ Railway deploy logs.                                           |
| [`railway_minimal_setup.md`](railway_minimal_setup.md)                                               | runbook    | Минимальный bootstrap Railway для log pipeline.                              |
| [`railway_s3_setup.md`](railway_s3_setup.md)                                                         | runbook    | Настройка S3/MinIO для Railway.                                              |
| [`railway_split_services.md`](railway_split_services.md)                                             | runbook    | Актуальный split-runbook для API/Bot/Worker.                                 |
| [`stress_plan.md`](stress_plan.md)                                                                   | runbook    | Нагрузочные и отказоустойчивые проверки.                                     |
| [`support_faq.md`](support_faq.md)                                                                   | runbook    | FAQ саппорта и быстрые ответы по troubleshooting.                            |
| [`vscode_local_setup.md`](vscode_local_setup.md)                                                     | runbook    | Локальная подготовка окружения для разработки и e2e.                         |
| [`security/audit_ci_false_positives.md`](security/audit_ci_false_positives.md)                       | runbook    | Практика triage для security false positives.                                |
| [`security/cookies_csrf.md`](security/cookies_csrf.md)                                               | runbook    | Текущий CSRF/cookies runbook.                                                |
| [`security/csp.md`](security/csp.md)                                                                 | runbook    | Текущая CSP-политика и правила сопровождения.                                |
| [`security/dependabot_prs.md`](security/dependabot_prs.md)                                           | runbook    | Порядок обработки Dependabot PR.                                             |
| [`file_service_refactor.md`](file_service_refactor.md)                                               | historical | Разовый проектный дизайн файлового сервиса; не канонический source-of-truth. |
| [`lazy_loading.md`](lazy_loading.md)                                                                 | historical | Локальный архитектурный срез web-оптимизаций, не нормативный документ.       |
| [`service_priorities.md`](service_priorities.md)                                                     | historical | Стратегическая заметка о приоритетах выделения сервисов.                     |
| [`test_reports/2025-10-28_stability_checks.md`](test_reports/2025-10-28_stability_checks.md)         | historical | Проверочный отчёт/evidence.                                                  |
| [`test_reports/2025-10-29-coverage-and-checks.md`](test_reports/2025-10-29-coverage-and-checks.md)   | historical | Проверочный отчёт/evidence.                                                  |
| [`test_reports/2026-02-12_monorepo-a5-baseline.md`](test_reports/2026-02-12_monorepo-a5-baseline.md) | historical | Baseline-отчёт по шагу унификации монорепозитория.                           |

### Архив `docs/archive/`

| Документ                                                                                           | Статус  | Причина переноса                                               |
| -------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------- |
| [`archive/README.md`](archive/README.md)                                                           | archive | Объясняет политику архива.                                     |
| [`archive/apply_analysis_plan.md`](archive/apply_analysis_plan.md)                                 | archive | Follow-up по старому анализу, не живой backlog.                |
| [`archive/codebase_review_2026-02-11.md`](archive/codebase_review_2026-02-11.md)                   | archive | Разовый review backlog snapshot.                               |
| [`archive/codex_system_prompt.md`](archive/codex_system_prompt.md)                                 | archive | Убрано из active docs во избежание дублирования AI-инструкций. |
| [`archive/extended_tailadmin_guide.md`](archive/extended_tailadmin_guide.md)                       | archive | Исторический UI/reference-материал.                            |
| [`archive/futureUpdates.md`](archive/futureUpdates.md)                                             | archive | Старый план/черновик.                                          |
| [`archive/monorepo-unification-b1.md`](archive/monorepo-unification-b1.md)                         | archive | Разовый отчёт по шагу унификации.                              |
| [`archive/monorepo-unification-b3.md`](archive/monorepo-unification-b3.md)                         | archive | Разовый отчёт по шагу унификации.                              |
| [`archive/monorepo-unification-task-breakdown.md`](archive/monorepo-unification-task-breakdown.md) | archive | Исторический пошаговый план работ.                             |
| [`archive/moodboard.md`](archive/moodboard.md)                                                     | archive | Исторический визуальный/идейный материал.                      |
| [`archive/railway_env_review.md`](archive/railway_env_review.md)                                   | archive | Разовая проверка Railway env snapshot.                         |
| [`archive/railway_split_readiness_audit.md`](archive/railway_split_readiness_audit.md)             | archive | Аудит готовности на конкретный момент времени.                 |
| [`archive/railway_task_board.md`](archive/railway_task_board.md)                                   | archive | Разовый ops-трекер, зависящий от ручного подтверждения.        |
| [`archive/routing_research.md`](archive/routing_research.md)                                       | archive | Исследовательский материал по OR-Tools/VRP.                    |
| [`archive/typescript_migration_plan.md`](archive/typescript_migration_plan.md)                     | archive | Исторический план завершённой миграции.                        |
| [`archive/ui-skeleton.md`](archive/ui-skeleton.md)                                                 | archive | Исторический UI-черновик.                                      |
| [`archive/workspace-audit-a1.md`](archive/workspace-audit-a1.md)                                   | archive | Разовый workspace audit snapshot.                              |

## 6) Правило согласованности и doc-audit

Перед релизом и перед PR с изменениями документации нужно выполнить `pnpm run docs:audit`.

Doc-audit считается успешным, если одновременно соблюдены условия:

1. Канонический набор документов существует и перекрёстно ссылается друг на друга.
2. `README.md` и `docs/README.md` ведут только на актуальные entry points, а не на historical/archive материалы как на source-of-truth.
3. `docs/README.md` и `docs/index.md` содержат ссылки на критичные runbook-документы (`queue_recovery_runbook.md`, `logistics_recovery_plan.md`, `railway_full_setup.md`, `railway_logs.md`, `support_faq.md`).
4. Historical/research/audit материалы не остаются рядом с active entry points, если они больше не описывают текущее состояние.
5. Новые PR не создают второй независимый список source-of-truth вне `README.md` + `docs/index.md`.

## 7) Приоритет при расхождениях

При расхождениях между документами используйте приоритет:

1. `AGENTS.md` + `.openai/assistant_instructions.json`
2. `README.md`
3. Канонический набор документов из раздела 2 этого индекса
4. Runbook / operational layer из раздела 3
5. Historical и archive материалы из разделов 4–5

Если старый документ описывает прежнюю архитектуру (`src/common`, `decorators`, `modules/*`) или непроверенный Railway/UI snapshot как факт, его нужно трактовать как `historical`/`archive` до отдельного обновления.
