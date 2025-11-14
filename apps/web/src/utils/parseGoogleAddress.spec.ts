/**
 * Назначение файла: проверки работы parseGoogleAddress.
 * Основные модули: parseGoogleAddress.
 */
import parseGoogleAddress from './parseGoogleAddress';

describe('parseGoogleAddress', () => {
  test('возвращает короткий адрес', () => {
    const url = 'https://www.google.com/maps/place/Some+Place/@0,0,17z';
    expect(parseGoogleAddress(url)).toBe('Some Place');
  });

  test('возвращает пустую строку при пустой строке', () => {
    expect(parseGoogleAddress('')).toBe('');
  });

  test('возвращает исходное значение при некорректном URL', () => {
    const invalid = 'not a url';
    expect(parseGoogleAddress(invalid)).toBe(invalid);
  });

  test('возвращает координаты, когда в ссылке нет названия', () => {
    const coordsUrl = 'https://www.google.com/maps/@48.477836,30.70593,17z';
    expect(parseGoogleAddress(coordsUrl)).toBe('48.477836, 30.705930');
  });

  test('возвращает заглушку, если координаты не найдены', () => {
    const fallbackUrl = 'https://maps.app.goo.gl/qYCv7Xdd8Q5xd2SFA';
    expect(parseGoogleAddress(fallbackUrl)).toBe('Точка на карте');
  });
});
