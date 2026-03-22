<!-- Назначение файла: руководство по сопровождению security/dependency PR и фиксации evidence. -->

# Аппрув и группировка security PR

## Control card

- **Owner:** maintainer, апрувящий dependency/security PR.
- **Trigger:** каждый Dependabot PR, ручное обновление зависимостей, release с изменением lockfile.
- **Evidence of completion:**
  - успешный audit зависимостей (`./scripts/audit_deps.sh` или эквивалентный CI run);
  - ссылка на GHSA/CVE или release notes зависимости;
  - решение по merge/rollback/allowlist;
  - для крупных пачек — ссылка на общий tracking issue.
- **Automation status:** частично автоматизировано. `Codex Quality Gate` декларирует dependency audit, но канонический рабочий запуск на текущий момент — `./scripts/audit_deps.sh`.

## Правила обработки

- Dependabot обычно создаёт PR с фокусом на одну или несколько зависимостей; приоритет определяется severity и влиянием на runtime.
- Перед аппрувом убедитесь, что dependency audit прошёл успешно.
- При ложных срабатываниях см. `docs/security/audit_ci_false_positives.md`.
- При большом количестве запросов объединяйте их вручную в общую ветку или используйте `squash` при слиянии.
- После проверки жмите **Approve** и выполняйте `Squash and merge`.

## Что приложить в PR

1. Короткое описание, какие пакеты обновлены и зачем.
2. Результат dependency audit.
3. Риск-оценку: runtime / dev-only / build-only.
4. План отката, если апдейт затрагивает auth, build, deployment или browser runtime.
