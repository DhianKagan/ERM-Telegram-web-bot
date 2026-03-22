<!-- Назначение файла: единый индекс документации и статусов документов. -->

# Индекс документации

## 1) Назначение индекса

Файл фиксирует, какие документы считаются рабочими, а какие — историческими.

## 2) Канонические документы

| Раздел               | Документ                                                                                                                               | Статус       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Обзор проекта        | [`../README.md`](../README.md)                                                                                                         | ✅ актуально |
| Общий вход в docs    | [`README.md`](README.md)                                                                                                               | ✅ актуально |
| Архитектура monorepo | [`architecture.md`](architecture.md)                                                                                                   | ✅ канон     |
| Технический мануал   | [`technical_manual.md`](technical_manual.md)                                                                                           | ✅ актуально |
| Maps expand runtime  | [`technical_manual.md#api-headless-fallback-для-google-maps-expand`](technical_manual.md#api-headless-fallback-для-google-maps-expand) | ✅ актуально |
| Права и роли         | [`permissions.md`](permissions.md)                                                                                                     | ✅ актуально |
| Вклад в проект       | [`../CONTRIBUTING.md`](../CONTRIBUTING.md)                                                                                             | ✅ актуально |
| Безопасность         | [`../SECURITY.md`](../SECURITY.md)                                                                                                     | ✅ актуально |

> `architecture.md` — канонический документ по фактической структуре `apps/api`, `apps/web`, `apps/worker`, `packages/shared` и operational-слою `scripts`.

## 3) Эксплуатационные runbook-документы

- [`railway_full_setup.md`](railway_full_setup.md)
- [`railway_minimal_setup.md`](railway_minimal_setup.md)
- [`railway_split_services.md`](railway_split_services.md)
- [`railway_s3_setup.md`](railway_s3_setup.md)
- [`queue_recovery_runbook.md`](queue_recovery_runbook.md)
- [`logistics_recovery_plan.md`](logistics_recovery_plan.md)
- [`auth_bearer_rollout.md`](auth_bearer_rollout.md)

## 4) Исторические материалы

- Исследования, разовые аудиты и task-board документы остаются в `docs/` как reference-материалы.
- Устаревшие гайды и черновики переносятся в [`archive/`](archive/).
- Если старый документ ссылается на `src/common`, `decorators` или `modules/*` как на текущую верхнеуровневую архитектуру, его нужно считать историческим до обновления.

## 5) Правило согласованности

При расхождениях между документами используйте приоритет:

1. `AGENTS.md` + `.openai/assistant_instructions.json`
2. `README.md`
3. `docs/*.md`

Это правило синхронизировано с `AGENTS.md` и `.openai/assistant_instructions.json` (v3.0).
