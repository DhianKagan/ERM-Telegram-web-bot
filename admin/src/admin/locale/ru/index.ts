/**
 * Назначение: русская локализация для AdminJS.
 * Основные модули: JSON-файлы переводов common, components, pages.
 */
import type { LocaleTranslations } from 'adminjs';

import common from './common.json' assert { type: 'json' };
import components from './components.json' assert { type: 'json' };
import pages from './pages.json' assert { type: 'json' };

const ruLocale: LocaleTranslations = {
  ...common,
  ...components,
  ...pages,
};

export default ruLocale;
