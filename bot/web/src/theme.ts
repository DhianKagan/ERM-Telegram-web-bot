/**
 * Назначение файла: инициализация светлой темы для веб-клиента.
 * Основные модули: localStorage, document.
 */
localStorage.setItem('theme', 'light');
document.documentElement.classList.remove('dark');
