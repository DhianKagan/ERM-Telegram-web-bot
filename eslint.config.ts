/**
 * Назначение файла: базовая конфигурация ESLint для сервера и клиента.
 * Подключает стандартные правила, окружение Node и поддержку TypeScript,
 * запрещая любые JavaScript-файлы.
 */
import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

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
      // Запрещаем импорт модулей клиентского приложения
      'no-restricted-imports': [
        'error',
        {
          paths: ['lodash', 'moment'],
          patterns: ['apps/web/**'],
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
    files: ['**/*.ts'],    languageOptions: {
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
      // Запрещаем импорт модулей клиентского приложения
      'no-restricted-imports': [
        'error',
        {
          paths: ['lodash', 'moment'],
          patterns: ['apps/web/**'],
        },
      ],
    },
  },
];

export default config;
