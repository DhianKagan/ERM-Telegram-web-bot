/**
 * Назначение файла: тесты фильтрации некорректных сегментов в normalizePointsString.
 * Основные модули: shared/geo.
 */

import { normalizePointsString } from 'shared';

describe('geo.normalizePointsString', () => {
  it('игнорирует точки с отсутствующей координатой вместо преобразования в 0', () => {
    expect(normalizePointsString('30.5,50.4; ,50.6;31.0,51.0;32.0,')).toEqual([
      [30.5, 50.4],
      [31, 51],
    ]);
  });
});
