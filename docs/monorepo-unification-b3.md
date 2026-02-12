# Шаг B3 — единая оркестрация через Turborepo

Дата: 12 Feb 2026 (Europe/Kyiv)
Источник: `docs/monorepo-unification-task-breakdown.md`.

## Что сделано

- Подключён `turbo` в корне монорепозитория как единый task runner для workspace.
- Добавлен файл `turbo.json` с описанием графа задач (`build`, `typecheck`, `lint`, `test`, `ci:fast`, `ci:full`, `dev`) и настройками кэша/outputs.
- Корневые команды оркестрации стандартизированы и переведены на Turborepo: `build`, `dev`, `test`, `lint`, `typecheck`, `check`, `check:full`, `ci:fast`, `ci:full`.

## Результат

- Монорепозиторий использует единый граф задач с инкрементальным выполнением и кэшированием.
- `ci:fast`/`ci:full` запускаются консистентно через один оркестратор на уровне root.
- Подготовлена база для оптимизации CI по изменённым пакетам (remote/local cache при необходимости).
