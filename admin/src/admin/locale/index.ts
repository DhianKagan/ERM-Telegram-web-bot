/**
 * Назначение: объединение локализаций AdminJS и подключение кастомных переводов.
 * Основные модули: AdminJSLocales, de, en, ru.
 */
import { Locale, locales as AdminJSLocales } from 'adminjs';

import de from './de/index.js';
import en from './en/index.js';
import ru from './ru/index.js';

const localeKey = process.env.LOCALE || 'en';
const customLanguage = 'mk';

export const locale: Locale = {
  language: localeKey,
  availableLanguages: [...Object.keys(AdminJSLocales), customLanguage].sort(),
  localeDetection: true,
  withBackend: true,
  translations: {
    de,
    en,
    ru,
    [customLanguage]: {
      components: {
        LanguageSelector: {
          availableLanguages: {
            de: 'германски',
            en: 'Англиски',
            es: 'шпански',
            it: 'италијански',
            pl: 'полски',
            mk: 'македонски',
            'pt-BR': 'португалски (Бразил)',
            ua: 'украински',
            'zh-CN': 'кинески',
          },
        },
      },
    },
  },
};
