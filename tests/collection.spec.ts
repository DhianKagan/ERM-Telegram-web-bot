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
      token: 'секрет-1',
      locatorUrl: 'https://host/locator?t=MTIz',
      baseUrl: 'https://hst-api.wialon.com',
      locatorKey: 'MTIz',
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
      token: 'секрет-1',
      locatorUrl: 'https://host/locator?t=MTIz',
      baseUrl: 'https://hst-api.wialon.com',
      locatorKey: 'MTIz',
    });
    fleets.create({
      id: 'f2',
      name: 'Флот-2',
      token: 'секрет-2',
      locatorUrl: 'https://host/locator?t=NDU2',
      baseUrl: 'https://hst-api.wialon.com',
      locatorKey: 'NDU2',
    });
    const list = fleets.list();
    expect(list).toHaveLength(2);
  });
});
