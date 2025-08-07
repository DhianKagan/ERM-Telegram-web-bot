/**
 * Назначение файла: базовая конфигурация ESLint для сервера и клиента.
 * Подключает стандартные правила, окружение Node и поддержку TypeScript,
 * запрещая любые JavaScript-файлы.
 */
import js from './bot/node_modules/@eslint/js/src/index.js';
import globals from './bot/node_modules/globals/index.js';
import tsParser from './bot/node_modules/@typescript-eslint/parser/dist/index.js';
import tsPlugin from './bot/node_modules/@typescript-eslint/eslint-plugin/dist/index.js';

const config = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message: 'Используйте TypeScript вместо JavaScript',
        },
      ],
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
  {
    files: ['**/*.ts'],
    ignores: ['bot/web/**'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsParser,
      globals: globals.node,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-undef': 'off',
    },
  },
];

export default config;
module.exports = config;
