<!-- Назначение файла: актуальная точка входа в документацию проекта. -->

# Документация ERM Telegram Web Bot

Этот файл — навигационный вход в документацию. Канонический список поддерживаемых документов фиксируется в [`docs/index.md`](index.md), а здесь собраны быстрые переходы без дублирования отдельной «второй правды».

## Канонический набор документов

- [Корневой обзор проекта (`../README.md`)](../README.md)
- [Навигационный вход в docs (`docs/README.md`)](README.md)
- [Индекс и модель поддержки документации (`docs/index.md`)](index.md)
- [Технический мануал (`docs/technical_manual.md`)](technical_manual.md)
- [Архитектурный обзор (`docs/architecture.md`)](architecture.md)

## Модель поддержки документации

- `README.md` даёт верхнеуровневый обзор проекта и ведёт в docs.
- `docs/README.md` остаётся удобной точкой входа для человека, но не хранит собственный отдельный список source-of-truth вне `docs/index.md`.
- `docs/index.md` — единственное место, где перечислен канонический набор документов и слои поддержки.
- `docs/technical_manual.md` описывает runtime, настройку, `/api/v1/maps/expand` и `MAPS_HEADLESS_FALLBACK`.
- `docs/architecture.md` поддерживается как каноническое дополнение для структуры monorepo, когда меняются каталоги, процессы или системные связи.
- Runbook-материалы поддерживаются отдельно от канонического набора и должны ссылаться на него, а не заменять его.

## Актуальные документы

### Базовые

- [Индекс документации](index.md)
- [Архитектура monorepo и runtime-слоёв](architecture.md)
- [Технический мануал](technical_manual.md)
- [Google Maps expand: headless-fallback и runtime-настройка](technical_manual.md#api-headless-fallback-для-google-maps-expand)
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

Актуальные инструкции (v3.0) хранятся только в:

- [`../AGENTS.md`](../AGENTS.md)
- [`../.openai/assistant_instructions.json`](../.openai/assistant_instructions.json)
