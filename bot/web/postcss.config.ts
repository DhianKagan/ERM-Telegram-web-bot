/**
 * Назначение файла: конфигурация PostCSS для фронтенда.
 * Основные модули: @tailwindcss/postcss, autoprefixer.
 */
import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

export default {
  plugins: [tailwindcss, autoprefixer],
};
