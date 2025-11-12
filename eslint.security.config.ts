/**
 * Назначение файла: конфигурация ESLint для запуска безопасности.
 * Подключает правила eslint-plugin-security к TypeScript-коду сервера и клиента.
 */
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import securityPlugin from 'eslint-plugin-security';

const config = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['apps/api/public/**', 'apps/web/public/**', 'dist/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      security: securityPlugin,
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...securityPlugin.configs.recommended.rules,
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
    },
  },
];

export default config;
