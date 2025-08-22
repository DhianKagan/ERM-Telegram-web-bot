/**
 * Конфигурация ESLint для веб-клиента
 * Модули: eslint-plugin-react-hooks, eslint-plugin-react-refresh
 */
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

const config = [
  { ignores: ["dist"] },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
      parser: tsParser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { varsIgnorePattern: "^[A-Z_]" },
      ],
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
];

export default config;
