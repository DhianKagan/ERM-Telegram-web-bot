/**
 * Назначение файла: проверки работы parseJwt.
 * Основные модули: parseJwt.
 */
import parseJwt from './parseJwt';

function toBase64Url(value: string): string {
  return btoa(value)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

describe('parseJwt', () => {
  test('извлекает payload', () => {
    const payload = { a: 1 };
    const token = `aaa.${btoa(JSON.stringify(payload))}.bbb`;
    expect(parseJwt<typeof payload>(token)).toEqual(payload);
  });

  test('корректно разбирает base64url payload без padding', () => {
    const payload = { role: 'manager', exp: 1710000000 };
    const token = `aaa.${toBase64Url(JSON.stringify(payload))}.bbb`;

    expect(parseJwt<typeof payload>(token)).toEqual(payload);
  });

  test('возвращает null при пустой строке', () => {
    expect(parseJwt('')).toBeNull();
  });
});
