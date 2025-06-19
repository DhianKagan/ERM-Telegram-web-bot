/**
 * Назначение: описание параметров пользовательской темы.
 * Ключевые модули: ThemeConfig, overrides.
 */
import type { ThemeConfig } from 'adminjs';
import { overrides } from './overrides.js';

export const themeConfig: ThemeConfig = {
  id: 'custom-theme',
  name: 'custom theme',
  overrides,
};
