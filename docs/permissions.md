<!-- Назначение файла: описание масок доступа, коллекции roles и разрешений. -->

# Права доступа и роли

## Маски доступа

В `apps/api/src/utils/accessMask.ts` определены константы масок:

| Константа        | Значение | Описание                        |
| ---------------- | -------- | ------------------------------- |
| `ACCESS_USER`    | `1`      | Обычный пользователь            |
| `ACCESS_ADMIN`   | `2`      | Администратор                   |
| `ACCESS_MANAGER` | `4`      | Менеджер или промежуточная роль |

Функция `hasAccess(mask, required)` проверяет наличие прав, а `accessByRole(name)` из `apps/api/src/db/queries.ts` вычисляет маску по названию роли.

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
