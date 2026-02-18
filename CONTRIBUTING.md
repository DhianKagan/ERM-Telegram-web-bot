<!-- Назначение файла: актуальные правила внесения изменений в проект. -->

# Contributing

Спасибо за вклад в ERM Telegram Web Bot.

## Базовый процесс

1. Создайте ветку `fix/<short-description>` или `feat/<short-description>`.
2. Внесите минимально необходимые изменения.
3. Обновите документацию, если меняется поведение API/UI/инфраструктуры.
4. Перед PR выполните релевантные проверки (build/lint/typecheck/test).
5. Откройте PR с понятным описанием изменений и шагами проверки.

## Оформление коммитов

Используйте формат:

`<type>(<scope>): short summary`

Примеры:

- `docs(readme): align root and docs index`
- `fix(api): handle nullable route distance`

## Требования к PR

В описании PR укажите:

- что изменено;
- зачем это сделано;
- как проверить;
- какие проверки запускались локально.

Шаблон: [`.github/pull_request_template.md`](.github/pull_request_template.md).

## Документация

Если вы меняете документацию:

- поддерживайте согласованность между `README.md`, `docs/README.md` и `docs/index.md`;
- не дублируйте инструкции для AI-ассистентов вне `AGENTS.md` и `.openai/assistant_instructions.json`;
- переносите устаревшие материалы в `docs/archive/`.
