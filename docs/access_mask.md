<!-- Назначение файла: описание системы масок доступа -->

# Маски доступа

Роли пользователя дополнены числовыми масками в поле `access`.

- `ACCESS_USER = 1` — обычный пользователь
- `ACCESS_ADMIN = 2` — администратор
- `ACCESS_MANAGER = 4` — менеджер или иная промежуточная роль

Коллекция `roles` хранит документы `{ name, permissions }`, маска вычисляется функцией `accessByRole(name)` из `apps/api/src/db/queries.ts`. Файл `apps/api/src/utils/accessMask.ts` содержит константы и функцию `hasAccess`. Middleware `checkRole` умеет принимать как строку роли, так и числовую маску. Примеры использования декоратора `Roles` приведены в `docs/permissions.md`.
