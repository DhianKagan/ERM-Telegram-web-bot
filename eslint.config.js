/**
 * Назначение файла: базовая конфигурация ESLint для серверной части.
 * Подключает стандартные правила и окружение Node.
 */
import js from './bot/node_modules/@eslint/js/src/index.js';
import globals from './bot/node_modules/globals/index.js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
];
