// Назначение: формирование HTML-ссылки на профиль пользователя
// Основные модули: отсутствуют
export default function userLink(id: number | string, name?: string): string {
  const text = name || String(id);
  return `<a href="tg://user?id=${id}" class="text-accentPrimary underline">${text}</a>`;
}
