<!-- Назначение файла: карта запросов к базе и API -->
# Карта запросов

Ниже перечислены основные операции с MongoDB и соответствующие маршруты API.

| Операция | Функция | Маршрут |
|----------|---------|---------|
| Создать задачу | `createTask()` | `POST /api/tasks` |
| Получить список задач | `getTasks()` | `GET /api/tasks` |
| Обновить задачу | `updateTask()` | `PATCH /api/tasks/:id` |
| Изменить статус | `updateTaskStatus()` | `POST /api/tasks/:id/status` |
| Добавить время | `addTime()` | `PATCH /api/tasks/:id/time` |
| Массовое обновление | `bulkUpdate()` | `POST /api/tasks/bulk` |
| Сводка по задачам | `summary()` | `GET /api/tasks/report/summary` |
| Пользователи | `createUser()`, `listUsers()` | `POST /api/users`, `GET /api/users` |
| Группы | `createGroup()`, `listGroups()` | `POST /api/groups`, `GET /api/groups` |
| Роли | `createRole()`, `listRoles()` | `POST /api/roles`, `GET /api/roles` |
| Логи | `writeLog()`, `listLogs()` | `POST /api/tasks/:id/status`, `GET /api/logs` |

Команды бота вызывают те же функции через `services/service.js`:

- `/create_task <текст>` — `createTask()`
- `/assign_task <userId> <taskId>` — `assignTask()`
- `/list_users` — `listUsers()`
- `/add_user <id> <username>` — `createUser()`
- `/list_tasks` — `listUserTasks()`
- `/update_task_status <taskId> <status>` — `updateTaskStatus()`
- `/list_all_tasks` — `listAllTasks()`
- `/upload_file <taskId>` — `addAttachment()`
- `/upload_voice <taskId>` — `addAttachment()`
- `/send_photo <url>` — `call('sendPhoto')`
- `/edit_last <id> <текст>` — `call('editMessageText')`
- `/app` — выдаёт ссылку на мини‑приложение
