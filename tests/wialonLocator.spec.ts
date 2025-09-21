/**
 * Назначение файла: проверка разбора ссылок локатора с некорректными query-параметрами.
 * Основные модули: utils/wialonLocator.
 */
import { parseLocatorLink } from '../apps/api/src/utils/wialonLocator';

describe('Разбор ссылок локатора Wialon', () => {
  test('использует hash, если query содержит некорректный параметр t', () => {
    const link = 'https://example.com/?t=%ZZ#t=cmF3VG9rZW4xMjM=';

    expect(() => parseLocatorLink(link)).not.toThrow();

    const parsed = parseLocatorLink(link);
    expect(parsed.locatorKey).toBe('cmF3VG9rZW4xMjM=');
    expect(parsed.token).toBe('rawToken123');
  });

  test('использует token из hash при ошибке декодирования query-параметра t', () => {
    const link = 'https://example.com/?t=%ZZ#token=cmF3VG9rZW4xMjM=';

    const parsed = parseLocatorLink(link);
    expect(parsed.locatorKey).toBe('cmF3VG9rZW4xMjM=');
    expect(parsed.token).toBe('rawToken123');
  });
});
