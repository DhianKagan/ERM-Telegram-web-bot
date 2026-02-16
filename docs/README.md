<!-- Назначение файла: краткий указатель документации. -->

# Документация

Базовый индекс документации: [index.md](index.md).
Отчёт шага A1 по унификации монорепозитория: [workspace-audit-a1.md](workspace-audit-a1.md).
Отчёт шага A5 (baseline проверок): [test_reports/2026-02-12_monorepo-a5-baseline.md](test_reports/2026-02-12_monorepo-a5-baseline.md).
Отчёт шага B1 (консолидация внутренних пакетов): [monorepo-unification-b1.md](monorepo-unification-b1.md).

Runbook по объектному хранилищу в Railway: [railway_s3_setup.md](railway_s3_setup.md).

Runbook по восстановлению очередей geocoding/DLQ: [queue_recovery_runbook.md](queue_recovery_runbook.md).

Все технические инструкции сведены в файл [technical_manual.md](technical_manual.md).
Разделы API и карта запросов перенесены в него,
отдельные файлы `api_reference.md` и `db_request_map.md` удалены.
Устаревшие материалы перемещены в каталог [archive](archive) для справки.

Инструкции для ассистентов и Codex поддерживаются только в [`../AGENTS.md`](../AGENTS.md) и [`../.openai/assistant_instructions.json`](../.openai/assistant_instructions.json). Устаревший `codex_integration.md` удалён, чтобы исключить конфликтующие правила.
Актуальный шаблон системного промпта для запуска сессий: [codex_system_prompt.md](codex_system_prompt.md) (используется как удобный старт, но не заменяет правила из AGENTS/JSON).
