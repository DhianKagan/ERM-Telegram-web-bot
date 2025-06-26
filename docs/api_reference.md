<!-- Назначение файла: краткое описание основных маршрутов API. -->
# Документация API

В проект встроен Swagger, полный список доступен по пути `/api-docs` после запуска сервера.
Ниже приведены основные маршруты:

| Метод | Путь | Описание |
|-------|------|---------|
| GET | /health | Проверка работоспособности сервера |
| POST | /auth/login | Получение JWT токена администратора |
| GET | /api/tasks | Список всех задач |
| POST | /api/tasks | Создание задачи |
| PUT | /api/tasks/:id | Обновление задачи |
| POST | /api/tasks/:id/status | Изменение статуса |
| GET | /api/tasks | Расширенный список задач |
| GET | /api/tasks/:id | Получить задачу |
| PATCH | /api/tasks/:id | Редактирование задачи |
| PATCH | /api/tasks/:id/time | Добавить время |
| POST | /api/tasks/bulk | Массовое обновление |
| GET | /api/tasks/report/summary | KPI отчёт (`from`, `to`) |
| GET | /api/groups | Список групп |
| POST | /api/groups | Создание группы |
| GET | /api/users | Список пользователей |
| POST | /api/users | Создание пользователя |
| GET | /api/roles | Список ролей |
| POST | /api/roles | Создание роли |
| GET | /api/logs | Последние логи |

