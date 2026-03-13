/**
 * Назначение файла: проверки извлечения slug из коротких ссылок для под-пути приложения.
 * Основные модули: services/shortLinks.
 */

describe('shortLinks.extractSlug', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  const importWithAppUrl = async (appUrl: string) => {
    jest.doMock('../apps/api/src/config', () => ({
      appUrl,
    }));
    return import('../apps/api/src/services/shortLinks');
  };

  it('извлекает slug из относительного пути c базовым префиксом приложения', async () => {
    const { extractSlug } = await importWithAppUrl(
      'https://example.com/telegram/webapp/',
    );

    expect(extractSlug('/telegram/webapp/l/demoSlug')).toBe('demoSlug');
  });

  it('не извлекает slug из пути без базового префикса приложения', async () => {
    const { extractSlug } = await importWithAppUrl(
      'https://example.com/telegram/webapp/',
    );

    expect(extractSlug('/l/demoSlug')).toBeNull();
  });

  it('не извлекает slug из пути с похожим, но некорректным префиксом', async () => {
    const { extractSlug } = await importWithAppUrl(
      'https://example.com/telegram/webapp/',
    );

    expect(extractSlug('/telegram/webapp-l/demoSlug')).toBeNull();
  });

  it('не извлекает slug из абсолютного URL с похожим, но некорректным префиксом', async () => {
    const { extractSlug } = await importWithAppUrl(
      'https://example.com/telegram/webapp/',
    );

    expect(
      extractSlug('https://example.com/telegram/webapp-l/demoSlug'),
    ).toBeNull();
  });
});
