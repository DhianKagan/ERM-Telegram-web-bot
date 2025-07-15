// Формирование HTML-ссылки на профиль пользователя по Telegram ID
// Модули: none
export default function userLink(id, name) {
  const text = name || id
  return `<a href="tg://user?id=${id}" class="text-accentPrimary underline">${text}</a>`
}
