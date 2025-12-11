/**
 * Назначение файла: тесты валидации и нормализации точек задач.
 * Основные модули: utils/taskPointsInput.
 */
import {
  prepareIncomingPoints,
  TaskPointsValidationError,
} from '../../src/utils/taskPointsInput';

jest.mock('../../src/services/maps', () => ({
  expandMapsUrl: jest.fn().mockImplementation((url: string) => {
    if (url.includes('first')) {
      return Promise.resolve('https://maps.google.com/?q=50.4500,30.5230');
    }
    return Promise.resolve('https://maps.google.com/?q=50.4600,30.5400');
  }),
}));

describe('prepareIncomingPoints', () => {
  it('дополняет координаты и заголовок из ссылки', async () => {
    const points = await prepareIncomingPoints([
      {
        kind: 'start',
        sourceUrl: 'https://maps.app.goo.gl/first',
      },
      {
        kind: 'finish',
        coordinates: { lat: 50.46, lng: 30.54 },
      },
    ]);

    expect(points).toHaveLength(2);
    expect(points[0].coordinates).toEqual({ lat: 50.45, lng: 30.523 });
    expect(points[0].title).toContain('50.4500');
    expect(points[0].sourceUrl).toMatch('maps.google.com');
  });

  it('бросает ошибку при недопустимой ссылке или координатах', async () => {
    await expect(
      prepareIncomingPoints([
        {
          kind: 'start',
          sourceUrl: '',
          coordinates: 'abc',
        },
        {
          kind: 'finish',
          coordinates: { lat: 0, lng: 0 },
        },
      ]),
    ).rejects.toBeInstanceOf(TaskPointsValidationError);
  });

  it('ограничивает количество точек десятью элементами', async () => {
    const payload = Array.from({ length: 11 }, (_, idx) => ({
      kind: 'via',
      order: idx,
      coordinates: { lat: 0, lng: idx * 0.01 },
    }));

    await expect(prepareIncomingPoints(payload)).rejects.toMatchObject({
      code: 'points_limit_exceeded',
    });
  });

  it('проверяет длину сегментов маршрута', async () => {
    await expect(
      prepareIncomingPoints([
        { kind: 'start', coordinates: { lat: 0, lng: 0 } },
        { kind: 'finish', coordinates: { lat: 0, lng: 5 } },
      ]),
    ).rejects.toMatchObject({ code: 'invalid_segment' });
  });
});
