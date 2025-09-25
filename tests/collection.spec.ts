/**
 * Назначение файла: unit-тесты Collection<T>.
 * Основные модули: Collection из packages/shared/collection-lib.
 */
import {
  Collection,
  Fleet,
  Department,
  Employee,
} from '../packages/shared/collection-lib';

describe('Collection', () => {
  test('создаёт и читает элемент', () => {
    const fleets = new Collection<Fleet>();
    const fleet = fleets.create({
      id: '1',
      name: 'Флот-1',
      registrationNumber: 'AA 1234 BB',
      odometerInitial: 1000,
      odometerCurrent: 1500,
      mileageTotal: 500,
      fuelType: 'Бензин',
      fuelRefilled: 120,
      fuelAverageConsumption: 0.1,
      fuelSpentTotal: 60,
      currentTasks: [],
    });
    expect(fleets.read('1')).toEqual(fleet);
  });

  test('обновляет существующий элемент', () => {
    const deps = new Collection<Department>();
    deps.create({ id: 'd1', fleetId: 'f1', name: 'Отдел-1' });
    const updated = deps.update('d1', { name: 'Отдел-1b' });
    expect(updated?.name).toBe('Отдел-1b');
  });

  test('удаляет элемент', () => {
    const emps = new Collection<Employee>();
    emps.create({ id: 'e1', departmentId: 'd1', name: 'Иван' });
    expect(emps.delete('e1')).toBe(true);
    expect(emps.read('e1')).toBeUndefined();
  });

  test('выводит список элементов', () => {
    const fleets = new Collection<Fleet>();
    fleets.create({
      id: 'f1',
      name: 'Флот-1',
      registrationNumber: 'AB 1111 CD',
      odometerInitial: 100,
      odometerCurrent: 200,
      mileageTotal: 100,
      fuelType: 'Дизель',
      fuelRefilled: 50,
      fuelAverageConsumption: 0.2,
      fuelSpentTotal: 20,
      currentTasks: [],
    });
    fleets.create({
      id: 'f2',
      name: 'Флот-2',
      registrationNumber: 'EF 2222 GH',
      odometerInitial: 200,
      odometerCurrent: 260,
      mileageTotal: 60,
      fuelType: 'Бензин',
      fuelRefilled: 30,
      fuelAverageConsumption: 0.15,
      fuelSpentTotal: 15,
      currentTasks: ['task-1'],
    });
    const list = fleets.list();
    expect(list).toHaveLength(2);
  });
});
