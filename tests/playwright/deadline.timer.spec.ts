/**
 * Назначение файла: e2e-тест расчёта прогресса сроков задач.
 * Основные модули: @playwright/test, taskDeadline.
 */
import { test, expect } from '@playwright/test';
import { getDeadlineState } from '../../apps/web/src/columns/taskDeadline';

test.describe('Калькулятор сроков задач', () => {
  const reference = new Date('2024-03-01T12:00:00.000Z');

  test('корректно распределяет уровни рисков', () => {
    const variants = [
      {
        start: '2024-02-20T12:00:00.000Z',
        due: '2024-03-20T12:00:00.000Z',
        expectKind: 'countdown' as const,
        expectLevel: 'safe' as const,
      },
      {
        start: '2024-02-01T12:00:00.000Z',
        due: '2024-03-15T12:00:00.000Z',
        expectKind: 'countdown' as const,
        expectLevel: 'warn' as const,
      },
      {
        start: '2024-02-15T12:00:00.000Z',
        due: '2024-03-02T12:00:00.000Z',
        expectKind: 'countdown' as const,
        expectLevel: 'danger' as const,
      },
      {
        start: '2024-02-01T12:00:00.000Z',
        due: '2024-02-20T12:00:00.000Z',
        expectKind: 'overdue' as const,
      },
    ];

    for (const variant of variants) {
      const state = getDeadlineState(variant.start, variant.due, reference);
      expect(state.kind).toBe(variant.expectKind);
      if (state.kind === 'countdown') {
        expect(state.level).toBe(variant.expectLevel);
      }
    }
  });

  test('обрабатывает отсутствующие и повреждённые даты', () => {
    const withoutDue = getDeadlineState('2024-02-01T12:00:00.000Z', undefined, reference);
    expect(withoutDue.kind).toBe('invalid');

    const withoutStart = getDeadlineState(undefined, '2024-03-05T12:00:00.000Z', reference);
    expect(withoutStart.kind).toBe('pending');

    const reversed = getDeadlineState('2024-03-10T12:00:00.000Z', '2024-03-01T12:00:00.000Z', reference);
    expect(reversed.kind).toBe('pending');
    if (reversed.kind === 'pending') {
      expect(reversed.issue).toBe('invalid-range');
    }

    const invalid = getDeadlineState('2024-02-01T12:00:00.000Z', 'неизвестно', reference);
    expect(invalid.kind).toBe('invalid');
  });
});
