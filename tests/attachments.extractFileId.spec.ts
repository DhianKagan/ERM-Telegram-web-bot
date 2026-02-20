/**
 * Назначение файла: тесты извлечения fileId из разных URL вложений.
 * Основные модули: attachments utils.
 */
import { extractFileIdFromUrl } from '../apps/api/src/utils/attachments';

describe('extractFileIdFromUrl', () => {
  test('извлекает id из базового URL файла', () => {
    expect(extractFileIdFromUrl('/api/v1/files/65f07f58d2b541f7a2502470')).toBe(
      '65f07f58d2b541f7a2502470',
    );
  });

  test('извлекает id из URL файла с /download', () => {
    expect(
      extractFileIdFromUrl('/api/v1/files/65f07f58d2b541f7a2502470/download'),
    ).toBe('65f07f58d2b541f7a2502470');
  });

  test('извлекает id из полного URL с query параметрами', () => {
    expect(
      extractFileIdFromUrl(
        'https://example.com/api/v1/files/65f07f58d2b541f7a2502470/download?mode=inline',
      ),
    ).toBe('65f07f58d2b541f7a2502470');
  });
});
