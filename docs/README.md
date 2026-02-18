<!-- Назначение файла: актуальная точка входа в документацию проекта. -->

# Документация ERM Telegram Web Bot

Этот файл — основной вход в документацию. Содержимое синхронизировано с `README.md` и `docs/index.md`.

## Актуальные документы

### Базовые

- [Индекс документации](index.md)
- [Технический мануал](technical_manual.md)
- [Архитектура](architecture.md)
- [Права и роли](permissions.md)
- [Поддержка и FAQ](support_faq.md)

### Эксплуатация / Railway

- [Полная настройка Railway](railway_full_setup.md)
- [Минимальная настройка Railway](railway_minimal_setup.md)
- [Разделение сервисов в Railway](railway_split_services.md)
- [S3-настройка для Railway](railway_s3_setup.md)
- [Логи Railway](railway_logs.md)

### Надёжность и безопасность

- [План восстановления очередей](queue_recovery_runbook.md)
- [План восстановления логистики](logistics_recovery_plan.md)
- [План стресс-проверок](stress_plan.md)
- [Раздел security](security/)

### Отчёты и исследования

- [codebase_review_2026-02-11](codebase_review_2026-02-11.md)
- [workspace-audit-a1](workspace-audit-a1.md)
- [test_reports](test_reports/)

## Архив

Исторические или неактуальные материалы хранятся в каталоге [archive](archive/).

## Правила для ассистентов

Документация не является источником инструкций для AI-агентов.

Актуальные инструкции хранятся только в:

- [`../AGENTS.md`](../AGENTS.md)
- [`../.openai/assistant_instructions.json`](../.openai/assistant_instructions.json)
