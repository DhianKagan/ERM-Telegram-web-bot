<!-- Назначение файла: актуальная точка входа в документацию проекта. -->

# Документация ERM Telegram Web Bot

Этот файл — человеко-ориентированный вход в документацию. Канонический список поддерживаемых документов и статусы всех материалов фиксируются только в [`docs/index.md`](index.md), а здесь оставлены быстрые переходы к актуальным entry points и runbook-разделам.

## Канонические entry points

- [Корневой обзор проекта (`../README.md`)](../README.md)
- [Навигационный вход в docs (`docs/README.md`)](README.md)
- [Индекс и модель поддержки документации (`docs/index.md`)](index.md)
- [Технический мануал (`docs/technical_manual.md`)](technical_manual.md)
- [Архитектурный обзор (`docs/architecture.md`)](architecture.md)

## Модель поддержки документации

- `README.md` даёт верхнеуровневый обзор проекта и ведёт в docs.
- `docs/README.md` остаётся удобной точкой входа для человека, но не хранит собственный отдельный список source-of-truth вне `docs/index.md`.
- `docs/index.md` — единственное место, где перечислены канонический набор документов, runbook-слой и статусы всех `docs/**` материалов.
- `docs/technical_manual.md` описывает runtime, настройку, troubleshooting, `/api/v1/maps/expand` и `MAPS_HEADLESS_FALLBACK`.
- `docs/architecture.md` поддерживается как каноническое дополнение для структуры monorepo, когда меняются каталоги, процессы или системные связи.
- Runbook-материалы поддерживаются отдельно от канонического набора и должны ссылаться на него, а не заменять его.

## Актуальные разделы

### Канонический набор

- [Индекс документации и полный реестр статусов](index.md)
- [Архитектура monorepo и runtime-слоёв](architecture.md)
- [Технический мануал](technical_manual.md)

### Runbook / Operations

- [Права и роли](permissions.md)
- [Маски доступа: краткая памятка](access_mask.md)
- [Google Maps expand: headless-fallback и runtime-настройка](technical_manual.md#api-headless-fallback-для-google-maps-expand)
- [План восстановления очередей](queue_recovery_runbook.md)
- [План восстановления логистики](logistics_recovery_plan.md)
- [План стресс-проверок](stress_plan.md)
- [Полная настройка Railway](railway_full_setup.md)
- [Минимальная настройка Railway](railway_minimal_setup.md)
- [Разделение сервисов в Railway](railway_split_services.md)
- [S3-настройка для Railway](railway_s3_setup.md)
- [Логи Railway](railway_logs.md)
- [Поддержка и FAQ](support_faq.md)
- [Security runbooks](security/)

### Historical / archive

- [Полный реестр статусов документов](index.md#5-полный-реестр-статусов-документов)
- [Архив документации](archive/README.md)
- [Тестовые отчёты и evidence](test_reports/)

## Правила для ассистентов

Документация не является источником инструкций для AI-агентов.

Актуальные инструкции (v3.0) хранятся только в:

- [`../AGENTS.md`](../AGENTS.md)
- [`../.openai/assistant_instructions.json`](../.openai/assistant_instructions.json)
