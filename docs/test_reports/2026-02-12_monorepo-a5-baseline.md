# A5 baseline — обязательные проверки монорепозитория

Дата запуска: 12 Feb 2026 (Europe/Kyiv)
Источник шага: `docs/monorepo-unification-task-breakdown.md` → Шаг A5.

## Контекст

Это первая итерация baseline для шага A5 (формат «текущее состояние»).
Цель — зафиксировать, что обязательный pipeline install/build/tsc/test/lint проходит из корня и сколько времени это занимает.

## Прогон обязательных команд

| Команда                              | Статус | Время |
| ------------------------------------ | ------ | ----: |
| `pnpm -w -s install`                 | PASS   |    3s |
| `pnpm --filter shared build`         | PASS   |    2s |
| `pnpm -r --filter '!shared' build`   | PASS   |  149s |
| `pnpm --filter apps/api exec tsc -b` | PASS   |    2s |
| `pnpm -w test`                       | PASS   |  200s |
| `pnpm -w lint`                       | PASS   |   14s |

**Итого:** 370s (~6m 10s).

## Наблюдения по стабильности

1. В `apps/web build` появляется предупреждение Browserslist о старых данных `caniuse-lite` (не блокирует сборку).
2. В `apps/api test` есть ожидаемые `console.warn/console.error/console.log` в тестовых сценариях; тесты завершаются со статусом PASS.
3. Критичных падений или флапающих проверок в этом прогоне не зафиксировано.

## Выдержки из логов

- `apps/web build: Browserslist: browsers data (caniuse-lite) is 6 months old. Please run: npx update-browserslist-db@latest`
- `status=PASS duration=149s` (build)
- `status=PASS duration=200s` (tests)
- `status=PASS duration=14s` (lint)
- `total_duration=370s`

Локальный лог прогона: `/tmp/a5-baseline.log`.
