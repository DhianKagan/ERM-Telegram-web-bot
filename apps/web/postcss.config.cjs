// PostCSS config для Vite. Используем плагин 'tailwindcss' вместо '@tailwindcss/postcss',
// чтобы избежать резолва '@tailwindcss/node' в pnpm-монорепе.
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
