// Назначение файла: проверка нормализации идентификаторов задач.
// Основные модули: coerceTaskId.
import coerceTaskId from './coerceTaskId';

describe('coerceTaskId', () => {
  it('возвращает строку для ObjectId', () => {
    expect(coerceTaskId({ $oid: '507f1f77bcf86cd799439011' })).toBe(
      '507f1f77bcf86cd799439011',
    );
  });

  it('отбрасывает некорректные значения', () => {
    expect(coerceTaskId('[object Object]')).toBeNull();
    expect(coerceTaskId(undefined)).toBeNull();
  });

  it('использует toString для объектов', () => {
    const value = { toString: () => '64e4e99d0b705d4df86f7d3a' };
    expect(coerceTaskId(value)).toBe('64e4e99d0b705d4df86f7d3a');
  });
});
