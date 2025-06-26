// Скрипт инициализации темы. Проверяет localStorage и
// системную настройку, добавляя класс `dark` к <html> при необходимости.
const savedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
  document.documentElement.classList.add('dark');
}
