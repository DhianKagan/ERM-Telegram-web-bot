/**
 * @jest-environment jsdom
 */
/**
 * Назначение файла: дополнительные тесты коллекций и хуков.
 * Основные модули: packages/shared/collection-lib, @testing-library/react.
 */
import { renderHook, act } from '@testing-library/react';
import {
  validateCollectionType,
  validateBaseItem,
  validateFleet,
  validateDepartment,
  validateEmployee,
  useCrud,
  type Fleet,
} from '../packages/shared/collection-lib';

describe('валидаторы коллекций', () => {
  test('распознаёт поддерживаемые типы коллекций', () => {
    expect(validateCollectionType('fleets')).toBe(true);
    expect(validateCollectionType('departments')).toBe(true);
    expect(validateCollectionType('employees')).toBe(true);
    expect(validateCollectionType('unknown')).toBe(false);
  });

  test('проверяет базовые атрибуты сущностей', () => {
    expect(validateBaseItem({ id: '1', name: 'Элемент' })).toBe(true);
    expect(validateBaseItem({ id: '', name: '' })).toBe(false);
  });

  test('валидирует конкретные сущности', () => {
    const fleet: Fleet = {
      id: 'f1',
      name: 'Флот',
      registrationNumber: 'AA 1234 BB',
      odometerInitial: 0,
      odometerCurrent: 10,
      mileageTotal: 10,
      fuelType: 'Бензин',
      fuelRefilled: 5,
      fuelAverageConsumption: 0.5,
      fuelSpentTotal: 5,
      currentTasks: [],
    };
    expect(validateFleet(fleet)).toBe(true);
    expect(
      validateFleet({ ...fleet, registrationNumber: '', fuelType: 'Другое' }),
    ).toBe(false);
    expect(validateDepartment({ id: 'd1', name: 'Отдел', fleetId: 'f1' })).toBe(
      true,
    );
    expect(validateDepartment({ id: 'd1', name: 'Отдел', fleetId: '' })).toBe(
      false,
    );
    expect(
      validateEmployee({ id: 'e1', name: 'Иван', departmentId: 'd1' }),
    ).toBe(true);
    expect(validateEmployee({ id: 'e1', name: 'Иван', departmentId: '' })).toBe(
      false,
    );
  });
});

describe('useCrud', () => {
  test('управляет коллекцией через create/read/update/delete', () => {
    const { result } = renderHook(() => useCrud<Fleet>());
    const fleet: Fleet = {
      id: 'f2',
      name: 'Флот-2',
      registrationNumber: 'BB 2345 CC',
      odometerInitial: 10,
      odometerCurrent: 25,
      mileageTotal: 15,
      fuelType: 'Дизель',
      fuelRefilled: 3,
      fuelAverageConsumption: 0.2,
      fuelSpentTotal: 2,
      currentTasks: [],
    };

    act(() => {
      result.current.create(fleet);
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.read('f2')).toEqual(fleet);

    act(() => {
      result.current.update('f2', { name: 'Флот обновлён' });
    });
    expect(result.current.read('f2')?.name).toBe('Флот обновлён');

    act(() => {
      result.current.delete('f2');
    });
    expect(result.current.items).toHaveLength(0);
  });
});
