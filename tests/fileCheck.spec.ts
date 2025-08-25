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
  test('отклоняет несовпадение', () => {
    const file = {
      originalname: 'a.txt',
      mimetype: 'image/png',
    } as Express.Multer.File;
    expect(checkFile(file)).toBe(false);
  });
});
