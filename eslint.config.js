/**
 * Назначение файла: базовая конфигурация ESLint для серверной части.
 * Подключает стандартные правила, окружение Node и поддержку TypeScript,
 * запрещая JavaScript-файлы вне конфигурации.
 */
import js from './bot/node_modules/@eslint/js/src/index.js';
import globals from './bot/node_modules/globals/index.js';
import tsParser from './bot/node_modules/@typescript-eslint/parser/dist/index.js';
import tsPlugin from './bot/node_modules/@typescript-eslint/eslint-plugin/dist/index.js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    ignores: [
      'eslint.config.js',
      'bot/eslint.config.js',
      'bot/web/eslint.config.js',
      'bot/babel.config.js',
    ],
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
