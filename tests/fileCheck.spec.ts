/**
 * Назначение файла: проверка проверки расширения и MIME.
 * Основные модули: utils/fileCheck.
 */
import { checkFile } from '../apps/api/src/utils/fileCheck';

describe('Проверка файлов', () => {
  test('разрешает png', () => {
    const file = {
      originalname: 'a.png',
      mimetype: 'image/png',
    } as Express.Multer.File;
    expect(checkFile(file)).toBe(true);
  });
  test('проставляет canonical MIME при пустом mimetype', () => {
    const file = {
      originalname: 'doc.pdf',
      mimetype: '',
    } as Express.Multer.File;

    const result = checkFile(file);

    expect(result).toBe(true);
    expect(file.mimetype).toBe('application/pdf');
  });
  test('отклоняет несовпадение', () => {
    const file = {
      originalname: 'a.txt',
      mimetype: 'image/png',
    } as Express.Multer.File;
    expect(checkFile(file)).toBe(false);
  });
});
