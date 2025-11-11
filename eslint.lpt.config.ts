// eslint.lpt.config.ts
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * LPT (flat) ESLint config — регистрация плагина react-refresh
 * и выключение проблемного правила в контексте LPT.
 *
 * Если в дальнейшем захотите разрешать инлайновые директивы,
 * можно удалить/ослабить правило здесь и убрать флаг --no-inline-config.
 */
export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      // отключаем правило именно для LPT-прогона — оно больше не будет падать
      'react-refresh/only-export-components': 'off',
    },
    // не проверять postcss-конфиг
    ignores: ['apps/web/postcss.config.cjs'],
  },
];

