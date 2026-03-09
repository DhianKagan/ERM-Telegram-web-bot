// Назначение: регрессионные тесты парсинга координат.
// Модули: utils/geo.

import { parsePointInput } from '../src/utils/geo';

describe('parsePointInput', () => {
  test('не переставляет lat/lng если lat выходит за диапазон', () => {
    expect(parsePointInput({ lat: 91, lng: 45 })).toBeNull();
  });

  test('парсит корректный объект lat/lng', () => {
    expect(parsePointInput({ lat: 50.4501, lng: 30.5234 })).toEqual({
      lat: 50.4501,
      lng: 30.5234,
    });
  });
});
