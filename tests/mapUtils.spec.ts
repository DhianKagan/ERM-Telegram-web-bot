/**
 * Назначение файла: проверка извлечения координат из ссылок.
 * Основные модули: extractCoords.
 */
import { extractCoords } from '../packages/shared/src/mapUtils';

describe('extractCoords', () => {
  it('извлекает координаты из сегмента @lat,lng', () => {
    const result = extractCoords(
      'https://www.google.com/maps/@49.123456,24.654321,17z',
    );
    expect(result).toEqual({ lat: 49.123456, lng: 24.654321 });
  });

  it('извлекает координаты из параметра query', () => {
    const result = extractCoords(
      'https://www.google.com/maps/search/?api=1&query=49.8379154,24.0181383',
    );
    expect(result).toEqual({ lat: 49.8379154, lng: 24.0181383 });
  });

  it('поддерживает формат !3d!4d для точек на карте', () => {
    const result = extractCoords(
      'https://www.google.com/maps/place/Точка/@49.8379154,24.0178469,19z/data=!3m1!1e3!3d49.8379154!4d24.0181383',
    );
    expect(result).toEqual({ lat: 49.8379154, lng: 24.0181383 });
  });

  it('извлекает координаты из вложенного параметра link', () => {
    const result = extractCoords(
      'https://maps.app.goo.gl/?link=https%3A%2F%2Fwww.google.com%2Fmaps%2Fsearch%2F%3Fapi%3D1%26query%3D50.4501%252C30.5234&apn=com.google.android.apps.maps',
    );
    expect(result).toEqual({ lat: 50.4501, lng: 30.5234 });
  });

  it('возвращает null при отсутствии координат', () => {
    expect(extractCoords('https://www.google.com/maps')).toBeNull();
  });
});
