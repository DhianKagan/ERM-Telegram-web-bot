<!-- Назначение файла: актуальные правила внесения изменений в проект. -->

# Contributing

Спасибо за вклад в ERM Telegram Web Bot.

## Базовый процесс

1. Создайте ветку `fix/<short-description>` или `feat/<short-description>`.
2. Внесите минимально необходимые изменения.
3. Обновите документацию, если меняется поведение API/UI/инфраструктуры.
4. Перед PR выполните релевантные проверки (build/lint/typecheck/test).
5. Если менялись `README.md`, `docs/**`, release workflow или runbook-ссылки, обязательно выполните `pnpm run docs:audit`.
6. Откройте PR с понятным описанием изменений и шагами проверки.

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

- считайте `docs/index.md` единственным реестром канонического набора и статусов `docs/**`;
- поддерживайте согласованность между `README.md`, `docs/README.md` и `docs/index.md`;
- не дублируйте инструкции для AI-ассистентов вне `AGENTS.md` и `.openai/assistant_instructions.json`;
- обновляйте runbook-ссылки в `docs/README.md` и `docs/index.md`, если меняется operational-слой;
- переносите устаревшие исследования, аудиты и разовые материалы в `docs/archive/`;
- не создавайте новый список source-of-truth в отдельном документе, если тот же статус уже зафиксирован в `README.md` или `docs/index.md`.
