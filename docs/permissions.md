<!-- Назначение файла: описание масок доступа, коллекции roles и разрешений. -->

# Права доступа и роли

## Маски доступа

В `apps/api/src/utils/accessMask.ts` определены константы масок:

| Константа            | Значение | Описание                           |
| -------------------- | -------- | ---------------------------------- |
| `ACCESS_USER`        | `1`      | Обычный пользователь               |
| `ACCESS_ADMIN`       | `2`      | Администратор                      |
| `ACCESS_MANAGER`     | `4`      | Менеджер или промежуточная роль    |
| `ACCESS_TASK_DELETE` | `8`      | Расширенный уровень удаления задач |

Функция `hasAccess(mask, required)` проверяет наличие прав, а `accessByRole(name)` из `apps/api/src/db/queries.ts` вычисляет маску по названию роли.
Роль `admin` объединяет `ACCESS_ADMIN` и `ACCESS_MANAGER` (`6`), наследуя права менеджера.
Удаление задач доступно только при маске `ACCESS_TASK_DELETE = 8`; её присваивают
вручную, не изменяя роль пользователя.
Просмотр архива задач (`/cp/archive`, `/api/v1/archives`) доступен администраторам с маской `6`,
а полное удаление архивных записей требует наличия маски `ACCESS_TASK_DELETE`.

## Коллекция `roles`

В базе данных существует коллекция `roles` с документами вида:

```json
{
  "name": "admin",
  "permissions": ["tasks", "logs"]
}
```

Поле `permissions` содержит список разрешённых действий или областей системы. Маска доступа не хранится и определяется по полю `name`.

Роли `admin` и `manager` получают полный список задач без фильтров.

### Обязательные роли

Скрипт `scripts/db/ensureDefaults.ts` ищет роли `user`, `admin` и `manager`
по имени и создаёт недостающие документы. Фиксированных идентификаторов больше
нет: приложения получают `roleId` из базы данных.

Он выполняется автоматически во время `pnpm build`, при необходимости
его можно запустить вручную:

```bash
pnpm ts-node scripts/db/ensureDefaults.ts
```

Если строка подключения к MongoDB не задана в переменных `MONGO_DATABASE_URL`,
`MONGODB_URI`, `MONGO_URL` или `MONGODB_URL`, скрипт лишь напишет предупреждение
и завершится без ошибок.

### Синхронизация ролей пользователей

Для обновления полей `role`, `roleId` и `access` выполните:

```bash
pnpm ts-node scripts/db/syncUserRoles.ts
```

Отдельная миграция `scripts/db/migrateUserRoleIds.ts` синхронизирует
`roleId` существующих пользователей, ориентируясь на значение поля `role`.

## Создание задач

Создавать задачи могут только пользователи с ролью `manager` или `admin`
(маска `ACCESS_MANAGER`). Обычные пользователи видят только назначенные им
задачи и не могут добавлять новые.

## Примеры использования декоратора `Roles`

### Обычный пользователь

```ts
router.get(
  '/profile',
  authMiddleware(),
  Roles(ACCESS_USER),
  rolesGuard,
  ctrl.profile,
);
```

### Администратор

```ts
router.get(
  '/roles',
  authMiddleware(),
  Roles(ACCESS_ADMIN),
  rolesGuard,
  ctrl.list,
);
```

### Менеджер

```ts
router.post(
  '/tasks',
  authMiddleware(),
  Roles(ACCESS_MANAGER),
  rolesGuard,
  ctrl.create,
);
```
