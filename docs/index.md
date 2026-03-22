<!-- Назначение файла: единый индекс документации и статусов документов. -->

# Индекс документации

## 1) Назначение индекса

Файл фиксирует канонический набор документов, модель поддержки документации и границы между поддерживаемыми materialized source-of-truth, runbook-слоем и historical/reference-слоем.

## 2) Канонический набор документов

Это единственное место, где перечислен поддерживаемый набор базовых документов проекта.

| Роль                      | Документ                                     | Статус поддержки       | Что обязано оставаться актуальным                                                            |
| ------------------------- | -------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| Корневой обзор проекта    | [`../README.md`](../README.md)               | ✅ canonical           | Верхнеуровневый обзор, быстрые команды, вход в docs                                          |
| Навигационный вход в docs | [`README.md`](README.md)                     | ✅ canonical           | Человеко-ориентированная навигация по docs без собственной «второй правды»                   |
| Индекс и policy docs      | [`index.md`](index.md)                       | ✅ canonical           | Список канонических документов, модель поддержки, слои документации                          |
| Технический мануал        | [`technical_manual.md`](technical_manual.md) | ✅ canonical           | Runtime, настройка, troubleshooting, `/api/v1/maps/expand`, `MAPS_HEADLESS_FALLBACK`         |
| Архитектурный обзор       | [`architecture.md`](architecture.md)         | ✅ canonical companion | Структура monorepo, runtime-слои и системные связи; обновляется при архитектурных изменениях |

## 3) Runbook / operational layer

Эти документы обязательны для эксплуатации и troubleshooting, но не заменяют канонический набор выше.

| Область                 | Документ(ы)                                                                                                                                  | Статус     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Railway bootstrap       | [`railway_full_setup.md`](railway_full_setup.md), [`railway_minimal_setup.md`](railway_minimal_setup.md)                                     | ✅ runbook |
| Railway split / storage | [`railway_split_services.md`](railway_split_services.md), [`railway_s3_setup.md`](railway_s3_setup.md), [`railway_logs.md`](railway_logs.md) | ✅ runbook |
| Recovery                | [`queue_recovery_runbook.md`](queue_recovery_runbook.md), [`logistics_recovery_plan.md`](logistics_recovery_plan.md)                         | ✅ runbook |
| Support / FAQ           | [`support_faq.md`](support_faq.md), [`auth_bearer_rollout.md`](auth_bearer_rollout.md)                                                       | ✅ runbook |

## 4) Модель поддержки документации

1. `README.md` даёт обзор и ведёт в `docs/README.md`, `docs/index.md` и `docs/technical_manual.md`.
2. `docs/README.md` даёт быстрые переходы по документации, но не объявляет собственный отдельный canonical list.
3. `docs/index.md` остаётся единственным реестром канонического набора документов и слоёв поддержки.
4. `docs/technical_manual.md` содержит актуальные runtime-детали, включая `/api/v1/maps/expand` и `MAPS_HEADLESS_FALLBACK`.
5. `docs/architecture.md` сопровождает канонический набор, когда меняется структура monorepo или runtime-связи.
6. Runbook-документы обязаны ссылаться на канонический набор и конкретные разделы troubleshooting вместо расплывчатых заявлений о «полном соответствии» без проверяемой привязки к разделу.

## 5) Reference / historical layer

Следующие документы индексируются только как вспомогательные материалы и не должны использоваться как первичный источник текущего состояния:

- [`../ROADMAP.md`](../ROADMAP.md) — актуальный план верхнего уровня, но не детальный source-of-truth по структуре/ops.
- [`codebase_review_2026-02-11.md`](codebase_review_2026-02-11.md) — historical review backlog.
- [`apply_analysis_plan.md`](apply_analysis_plan.md) — reference-сводка outcomes по старому анализу.
- [`typescript_migration_plan.md`](typescript_migration_plan.md) — historical snapshot завершённой миграции.
- [`railway_task_board.md`](railway_task_board.md) — ops-checklist, требующий подтверждения вне репозитория.
- [`workspace-audit-a1.md`](workspace-audit-a1.md) — historical audit snapshot.
- [`test_reports/`](test_reports/) — отчёты и evidence, а не нормативная документация.
- [`archive/`](archive/) — архив и снятые с поддержки материалы.

## 6) Правило согласованности

При расхождениях между документами используйте приоритет:

1. `AGENTS.md` + `.openai/assistant_instructions.json`
2. `README.md`
3. Канонический набор документов из раздела 2 этого индекса
4. Runbook / operational layer из раздела 3
5. Reference / historical layer

Если старый документ ссылается на прежнюю архитектуру (`src/common`, `decorators`, `modules/*`) или описывает непроверенное Railway/UI состояние как факт, его нужно трактовать как historical/reference до обновления.
