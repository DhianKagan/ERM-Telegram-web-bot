/**
 * @jest-environment jsdom
 */
// Назначение: проверка функции ensureInlineUploadFileName
// Основные модули: CKEditorPopup, File
import { ensureInlineUploadFileName } from './CKEditorPopup';

describe('ensureInlineUploadFileName', () => {
  it('возвращает исходное имя при наличии расширения', () => {
    const file = new File(['a'], 'photo.png', { type: 'image/png' });
    expect(ensureInlineUploadFileName(file)).toBe('photo.png');
  });

  it('добавляет расширение из типа файла', () => {
    const file = new File(['a'], 'screenshot', { type: 'image/jpeg' });
    expect(ensureInlineUploadFileName(file)).toBe('screenshot.jpg');
  });

  it('использует имя по умолчанию при пустом названии', () => {
    const file = new File(['a'], '', { type: '' });
    expect(ensureInlineUploadFileName(file)).toBe('image.png');
  });
});
