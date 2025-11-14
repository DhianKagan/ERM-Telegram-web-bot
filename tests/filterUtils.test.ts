/**
 * @jest-environment node
 */
// Назначение: тесты утилит нормализации фильтров задач
// Основные модули: filterUtils, Jest
import {
  normalizeTaskFilters,
  parseAssigneeList,
  parseStringList,
} from '../apps/api/src/tasks/filterUtils';

describe('task filter utilities', () => {
  it('нормализует списки строк с учётом пробелов и массивов', () => {
    expect(parseStringList('новая,   в работе , завершена')).toEqual([
      'новая',
      'в работе',
      'завершена',
    ]);
    expect(parseStringList(['новая', '  отменена  '])).toEqual([
      'новая',
      'отменена',
    ]);
    expect(parseStringList([[' a ', 'b'], 'c, d'])).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('корректно парсит идентификаторы исполнителей', () => {
    expect(parseAssigneeList('1, 2, 2, 3')).toEqual([1, 2, 3]);
    expect(parseAssigneeList([4, '5', ['6,7']])).toEqual([4, 5, 6, 7]);
    expect(parseAssigneeList(undefined)).toEqual([]);
  });

  it('нормализует фильтры задач и возвращает вспомогательные значения', () => {
    const {
      normalized,
      statusValues,
      taskTypeValues,
      assigneeValues,
      kindFilter,
    } = normalizeTaskFilters({
      status: 'new,in-progress , ,done',
      taskType: ['delivery', ' pickup '],
      assignees: '100,101',
      assignee: ['102', 103],
      from: '2024-01-01',
      to: '2024-01-31',
      kanban: '1',
      kind: ' request ',
    });

    expect(statusValues).toEqual(['new', 'in-progress', 'done']);
    expect(taskTypeValues).toEqual(['delivery', 'pickup']);
    expect(assigneeValues).toEqual([100, 101, 102, 103]);
    expect(kindFilter).toBe('request');
    expect(normalized).toEqual({
      status: ['new', 'in-progress', 'done'],
      taskType: ['delivery', 'pickup'],
      assignees: [100, 101, 102, 103],
      from: '2024-01-01',
      to: '2024-01-31',
      kanban: true,
      kind: 'request',
    });
  });

  it('поддерживает одиночные значения фильтров', () => {
    const { normalized, statusValues, taskTypeValues, assigneeValues } =
      normalizeTaskFilters({
        status: 'done',
        taskType: 'maintenance',
        assignees: [200],
        kanban: false,
      });

    expect(statusValues).toEqual(['done']);
    expect(taskTypeValues).toEqual(['maintenance']);
    expect(assigneeValues).toEqual([200]);
    expect(normalized).toEqual({
      status: 'done',
      taskType: 'maintenance',
      assignees: [200],
      kanban: false,
    });
  });
});
