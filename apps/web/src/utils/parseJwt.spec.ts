/**
 * Назначение файла: проверки работы parseJwt.
 * Основные модули: parseJwt.
 */
import parseJwt from './parseJwt';

describe('parseJwt', () => {
  test('извлекает payload', () => {
    const payload = { a: 1 };
    const token = `aaa.${btoa(JSON.stringify(payload))}.bbb`;
    expect(parseJwt<typeof payload>(token)).toEqual(payload);
  });

  test('возвращает null при пустой строке', () => {
    expect(parseJwt('')).toBeNull();
  });
});
