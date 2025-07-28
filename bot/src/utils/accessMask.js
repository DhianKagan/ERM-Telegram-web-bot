// Константы масок доступа и функция проверки
// Модули: отсутствуют
const ACCESS_USER = 1;
const ACCESS_ADMIN = 2;
// промежуточная роль, например менеджер
const ACCESS_MANAGER = 4;

function hasAccess(mask, required) {
  return (mask & required) === required;
}

module.exports = { ACCESS_USER, ACCESS_ADMIN, ACCESS_MANAGER, hasAccess };
