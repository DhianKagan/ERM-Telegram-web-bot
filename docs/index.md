<!-- Назначение файла: единый индекс документации и статусов документов. -->

# Индекс документации

## 1) Назначение индекса

Файл фиксирует, какие документы считаются поддерживаемым source of truth, а какие нужно читать только как reference/historical слой.

## 2) Поддерживаемые source-of-truth документы

| Раздел               | Документ                                                                                                                                                                                                         | Статус             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Обзор проекта        | [`../README.md`](../README.md)                                                                                                                                                                                   | ✅ source of truth |
| Общий вход в docs    | [`README.md`](README.md)                                                                                                                                                                                         | ✅ source of truth |
| Архитектура monorepo | [`architecture.md`](architecture.md)                                                                                                                                                                             | ✅ source of truth |
| Технический мануал   | [`technical_manual.md`](technical_manual.md)                                                                                                                                                                     | ✅ source of truth |
| Права и роли         | [`permissions.md`](permissions.md)                                                                                                                                                                               | ✅ source of truth |
| Безопасность         | [`../SECURITY.md`](../SECURITY.md)                                                                                                                                                                               | ✅ source of truth |
| Вклад в проект       | [`../CONTRIBUTING.md`](../CONTRIBUTING.md)                                                                                                                                                                       | ✅ source of truth |
| Эксплуатация Railway | [`railway_full_setup.md`](railway_full_setup.md), [`railway_minimal_setup.md`](railway_minimal_setup.md), [`railway_split_services.md`](railway_split_services.md), [`railway_s3_setup.md`](railway_s3_setup.md) | ✅ runbook layer   |
| Recovery / ops       | [`queue_recovery_runbook.md`](queue_recovery_runbook.md), [`logistics_recovery_plan.md`](logistics_recovery_plan.md), [`auth_bearer_rollout.md`](auth_bearer_rollout.md)                                         | ✅ runbook layer   |

> `architecture.md` остаётся каноническим описанием фактической структуры `apps/api`, `apps/web`, `apps/worker`, `packages/shared` и operational-слоя `scripts`.

## 3) Reference / historical layer

Следующие документы индексируются только как вспомогательные материалы и не должны использоваться как первичный источник текущего состояния:

- [`../ROADMAP.md`](../ROADMAP.md) — актуальный план верхнего уровня, но не детальный source-of-truth по структуре/ops.
- [`codebase_review_2026-02-11.md`](codebase_review_2026-02-11.md) — historical review backlog.
- [`apply_analysis_plan.md`](apply_analysis_plan.md) — reference-сводка outcomes по старому анализу.
- [`typescript_migration_plan.md`](typescript_migration_plan.md) — historical snapshot завершённой миграции.
- [`railway_task_board.md`](railway_task_board.md) — ops-checklist, требующий подтверждения вне репозитория.
- [`workspace-audit-a1.md`](workspace-audit-a1.md) — historical audit snapshot.
- [`test_reports/`](test_reports/) — отчёты и evidence, а не нормативная документация.
- [`archive/`](archive/) — архив и снятые с поддержки материалы.

## 4) Правило согласованности

При расхождениях между документами используйте приоритет:

1. `AGENTS.md` + `.openai/assistant_instructions.json`
2. `README.md`
3. Поддерживаемые source-of-truth документы из этого индекса
4. Reference / historical layer

Если старый документ ссылается на прежнюю архитектуру (`src/common`, `decorators`, `modules/*`) или описывает непроверенное Railway/UI состояние как факт, его нужно трактовать как historical/reference до обновления.
