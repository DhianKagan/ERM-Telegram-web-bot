<!-- Назначение файла: карта запросов к базе и API -->
# Карта запросов

Ниже перечислены основные операции с MongoDB и соответствующие маршруты API.

| Операция | Функция | Маршрут |
|----------|---------|---------|
| Создать задачу | `createTask()` | `POST /api/v1/tasks` |
| Получить список задач | `getTasks()` | `GET /api/v1/tasks` |
| Обновить задачу | `updateTask()` | `PATCH /api/v1/tasks/:id` |
| Изменить статус | `updateTaskStatus()` | `POST /api/v1/tasks/:id/status` |
| Добавить время | `addTime()` | `PATCH /api/v1/tasks/:id/time` |
| Массовое обновление | `bulkUpdate()` | `POST /api/v1/tasks/bulk` |
| Сводка по задачам | `summary()` | `GET /api/v1/tasks/report/summary` |
| Пользователи | `createUser()`, `listUsers()` | `POST /api/v1/users`, `GET /api/v1/users` |
| Логи | `writeLog()`, `listLogs()` | `POST /api/v1/tasks/:id/status`, `GET /api/v1/logs`, `POST /api/v1/logs` |
| Удалить задачу | `deleteTask()` | `DELETE /api/v1/tasks/:id` |

Команды бота вызывают те же функции через `services/service.js`:

- `/create_task <текст>` — `createTask()`
- `/list_users` — `listUsers()`
- `/add_user <id> <username>` — `createUser()`
- `/update_task_status <taskId> <status>` — `updateTaskStatus()`
- `/send_photo <url>` — `call('sendPhoto')`
- `/edit_last <id> <текст>` — `call('editMessageText')`
- `/app` — выдаёт ссылку на мини‑приложение
