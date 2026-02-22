# Full cycle checker for task + attachments + Telegram signal

Скрипт проходит полный цикл:

1. Подготавливает тестовые файлы (`txt`, `pdf`, `xlsx`, `jpg`, `png`, `mp4`) во временной директории.
2. Создаёт задачу через API с вложениями.
3. Ожидает появления Telegram-метаданных задачи (`telegram_message_id`, `telegram_topic_id` или `telegram_dm_message_ids`).
4. Удаляет задачу.
5. Проверяет, что задача недоступна (`404`) и пишет лог по статусу очистки файлов.
6. Всегда удаляет локальные временные файлы теста.

## Запуск

```bash
pnpm debug:full-cycle -- --base-url https://your-host --token <JWT>
```

или через ENV:

```bash
FULL_CYCLE_BASE_URL=https://your-host \
FULL_CYCLE_TOKEN=<JWT> \
pnpm debug:full-cycle
```

## Полезные параметры

- `--timeout-ms 60000` — время ожидания Telegram-метаданных.
- `--poll-ms 3000` — интервал опроса задачи.
- `--soft-telegram` — не падать, если метаданные Telegram не появились (только warning).
- `--log-file logs/full-cycle-custom.jsonl` — путь к jsonl-логам.

## Логи

Логи пишутся в JSONL и в консоль со стадиями (`setup`, `prepare_fixtures`, `create_task`, `telegram_check`, `delete_task`, `verify_task_deleted`, `verify_files_cleanup`, `cleanup_local`, `finish`).

Так видно точный этап сбоя и контекст ошибки.
