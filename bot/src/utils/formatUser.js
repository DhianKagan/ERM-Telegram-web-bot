// Функция форматирует пользователя, подставляя telegram_id в поле username
// Назначение файла: унифицированный вывод данных пользователя в API
module.exports = function formatUser(user) {
  if (!user) return null;
  const obj = user.toObject ? user.toObject() : { ...user };
  // сохраняем оригинальный username Telegram для интерфейса
  obj.telegram_username = obj.username;
  // в поле username API возвращает Telegram ID по требованиям
  obj.username = String(obj.telegram_id);
  return obj;
};
