<!-- Назначение файла: руководство по подключению Codex к репозиторию. Основные модули: GitHub Actions, Codex Cloud. -->

# Восстановление проверок Codex

## 1. Подключение Codex Cloud

1. Откройте https://developers.openai.com и убедитесь, что репозиторий подключён в Codex Cloud.
2. В настройках репозитория включите опцию **Code review**. Без неё Codex не увидит ваши pull request.
3. Проверьте, что установленное GitHub-приложение Codex имеет права чтения кода и создания проверок. При необходимости переустановите приложение и повторно выдайте права репозиторию.

## 2. Запуск обзоров Codex

1. После создания или обновления pull request оставьте комментарий `@codex review`.
2. Дождитесь, пока Codex выполнит анализ и оставит замечания. При необходимости повторите комментарий, если произошёл новый push.
3. Если бот не отвечает, перепроверьте включение Code review и наличие доступа GitHub-приложения.

## 3. Интеграция с текущим CI

1. Убедитесь, что workflows `ci.yml`, `docker.yml`, `codeql.yml` и `lighthouse.yml` продолжают запускаться для pull request.
2. В настройках Actions разрешите запуск workflow из форков (Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests).
3. Добавьте секрет `OPENAI_API_KEY` в настройки репозитория (Settings → Secrets → Actions). Ключ должен иметь доступ к Codex Cloud.

## 4. Автоматические исправления (опционально)

1. Создайте workflow `.github/workflows/codex-autofix.yml` по образцу ниже.
2. Убедитесь, что у workflow есть права `contents: write`, `pull-requests: write` и `checks: write`, чтобы Codex мог открыть ветку и оставить проверку.
3. После падения основного CI Codex выполнит автоматическую правку, повторно запустит тесты и создаст черновой PR с фиксом.

```yaml
# Назначение файла: запуск Codex Autofix после падения CI. Основные модули: workflow_run, openai/codex-action.
name: Codex Autofix

on:
  workflow_run:
    workflows: ['CI']
    types: [completed]

jobs:
  run-codex-autofix:
    if: >-
      ${{ github.event.workflow_run.conclusion == 'failure' &&
          github.event.workflow_run.event == 'pull_request' }}
    permissions:
      contents: write
      pull-requests: write
      checks: write
    runs-on: ubuntu-latest
    steps:
      - name: Загрузка исходного PR
        uses: actions/checkout@v4
        with:
          repository: ${{ github.event.workflow_run.head_repository.full_name }}
          ref: ${{ github.event.workflow_run.head_branch }}
      - name: Codex Autofix
        uses: openai/codex-action@v1
        with:
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          run: pnpm lint && pnpm test:unit && pnpm test:api
```

## 5. Контрольный список перед PR

- Репозиторий подключён к Codex Cloud и включена функция Code review.
- Секрет `OPENAI_API_KEY` существует и актуален.
- Комментарий `@codex review` добавлен в обсуждение PR.
- Основные workflows CI проходят без ошибок.
- (Опционально) Workflow Codex Autofix присутствует и завершился успешно при последнем падении CI.

Используйте этот чек-лист при каждом открытии PR, чтобы гарантировать появление проверки Codex.
