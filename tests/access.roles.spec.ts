/**
 * Назначение файла: проверка вычисления уровней доступа по ролям.
 * Основные модули: accessByRole из db/queries.
 */
import { accessByRole } from '../apps/api/src/db/queries';

describe('доступ по ролям', () => {
  test('администратор получает маску 2', () => {
    expect(accessByRole('admin')).toBe(2);
  });

  test('менеджер получает маску 4', () => {
    expect(accessByRole('manager')).toBe(4);
  });

  test('обычный пользователь получает маску 1', () => {
    expect(accessByRole('user')).toBe(1);
  });
});
