<!-- Назначение файла: единый индекс документации и статусов документов. -->

# Индекс документации

## 1) Назначение индекса

Файл фиксирует, какие документы считаются рабочими, а какие — историческими.

## 2) Канонические документы

| Раздел             | Документ                                     | Статус       |
| ------------------ | -------------------------------------------- | ------------ |
| Обзор проекта      | [`../README.md`](../README.md)               | ✅ актуально |
| Общий вход в docs  | [`README.md`](README.md)                     | ✅ актуально |
| Архитектура        | [`architecture.md`](architecture.md)         | ✅ актуально |
| Технический мануал | [`technical_manual.md`](technical_manual.md) | ✅ актуально |
| Права и роли       | [`permissions.md`](permissions.md)           | ✅ актуально |
| Вклад в проект     | [`../CONTRIBUTING.md`](../CONTRIBUTING.md)   | ✅ актуально |
| Безопасность       | [`../SECURITY.md`](../SECURITY.md)           | ✅ актуально |

## 3) Эксплуатационные runbook-документы

- [`railway_full_setup.md`](railway_full_setup.md)
- [`railway_minimal_setup.md`](railway_minimal_setup.md)
- [`railway_split_services.md`](railway_split_services.md)
- [`railway_s3_setup.md`](railway_s3_setup.md)
- [`queue_recovery_runbook.md`](queue_recovery_runbook.md)
- [`logistics_recovery_plan.md`](logistics_recovery_plan.md)

## 4) Исторические материалы

- Исследования, разовые аудиты и task-board документы остаются в `docs/` как reference-материалы.
- Устаревшие гайды и черновики переносятся в [`archive/`](archive/).

## 5) Правило согласованности

При расхождениях между документами используйте приоритет:

1. `AGENTS.md` + `.openai/assistant_instructions.json`
2. `README.md`
3. `docs/*.md`

Это правило синхронизировано с `AGENTS.md`.
