// Назначение файла: автоматические проверки pull request в Danger.
// Основные модули: Danger JS API, GitHub, анализ JSON локализаций.

import { danger, fail, warn, schedule } from 'danger';
import { readFileSync } from 'node:fs';

type LocaleKey = string;

const prBody = danger.github.pr.body?.trim();

if (!prBody) {
  fail('Добавьте развёрнутое описание PR в поле Description.');
}

const changedFiles = [
  ...danger.git.created_files,
  ...danger.git.modified_files,
];
const serviceFiles = changedFiles.filter((file) =>
  file.endsWith('.service.ts'),
);

if (serviceFiles.length > 0) {
  const testTouched = changedFiles.some(
    (file) =>
      /\.(spec|test)\.(ts|tsx)$/.test(file) ||
      file.startsWith('tests/') ||
      file.includes('/tests/') ||
      file.includes('__tests__/'),
  );

  if (!testTouched) {
    const formatted = serviceFiles.map((file) => `\`${file}\``).join(', ');
    fail(
      [
        'Обновлены файлы сервисов, но тесты не затронуты.',
        `Проверьте следующие файлы: ${formatted}.`,
        'Добавьте или обновите тесты и убедитесь, что они запускаются.',
      ].join(' '),
    );
  }
}

const totalChanges = danger.github.pr.additions + danger.github.pr.deletions;
const MAX_LINES = 800;

if (totalChanges > MAX_LINES) {
  warn(
    `Дифф содержит ${totalChanges} строк. Рассмотрите возможность разделить изменения на несколько PR (лимит ${MAX_LINES}).`,
  );
}

schedule(async () => {
  const locales = [
    { lang: 'ru', path: 'apps/web/src/locales/ru/translation.json' },
    { lang: 'en', path: 'apps/web/src/locales/en/translation.json' },
  ] as const;

  const loadLocale = (file: string) => {
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    } catch (error) {
      warn(
        `Не удалось прочитать файл локализации ${file}: ${(error as Error).message}`,
      );
      return {};
    }
  };

  const localeData = Object.fromEntries(
    locales.map((locale) => [locale.lang, loadLocale(locale.path)]),
  ) as Record<string, Record<string, unknown>>;

  const diffs = await Promise.all(
    locales.map(async (locale) => ({
      lang: locale.lang,
      diff: await danger.git.JSONDiffForFile(locale.path),
    })),
  );

  const getLocale = (lang: (typeof locales)[number]['lang']) =>
    localeData[lang] ?? {};

  const pathSegments = (path: LocaleKey): Array<string | number> => {
    const segments: Array<string | number> = [];
    const regex = /([^.[\]]+)|(\[(\d+)\])/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(path)) !== null) {
      if (match[1]) {
        segments.push(match[1]);
      } else if (match[3]) {
        segments.push(Number(match[3]));
      }
    }

    return segments;
  };

  const hasPath = (data: unknown, path: LocaleKey): boolean => {
    if (!path) {
      return true;
    }

    let current: unknown = data;

    for (const segment of pathSegments(path)) {
      if (typeof segment === 'number') {
        if (!Array.isArray(current) || current[segment] === undefined) {
          return false;
        }
        current = current[segment];
        continue;
      }

      if (
        !current ||
        typeof current !== 'object' ||
        !(segment in (current as Record<string, unknown>))
      ) {
        return false;
      }

      current = (current as Record<string, unknown>)[segment];
    }

    return true;
  };

  const ruDiff = diffs.find((diff) => diff.lang === 'ru')?.diff;
  const enDiff = diffs.find((diff) => diff.lang === 'en')?.diff;

  const ruAdded = new Set<LocaleKey>(ruDiff?.added ?? []);
  const enAdded = new Set<LocaleKey>(enDiff?.added ?? []);

  const missingInEn = [...ruAdded].filter(
    (key) => !hasPath(getLocale('en'), key),
  );
  const missingInRu = [...enAdded].filter(
    (key) => !hasPath(getLocale('ru'), key),
  );

  if (missingInEn.length > 0) {
    fail(
      `Для новых ключей перевода из ru нет соответствий в en: ${missingInEn
        .map((key) => `\`${key}\``)
        .join(', ')}.`,
    );
  }

  if (missingInRu.length > 0) {
    fail(
      `Для новых ключей перевода из en нет соответствий в ru: ${missingInRu
        .map((key) => `\`${key}\``)
        .join(', ')}.`,
    );
  }
});
