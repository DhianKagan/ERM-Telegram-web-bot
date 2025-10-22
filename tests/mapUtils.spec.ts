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

  it('возвращает null при отсутствии координат', () => {
    expect(extractCoords('https://www.google.com/maps')).toBeNull();
  });
});
