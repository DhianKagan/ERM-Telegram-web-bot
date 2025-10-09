/**
 * Назначение файла: проверка формирования текста истории задач.
 * Основные модули: buildHistorySummaryLog.
 */
import {
  buildHistorySummaryLog,
  buildLatestHistorySummary,
} from '../apps/api/src/tasks/taskMessages';

jest.mock('../apps/api/src/db/queries', () => ({
  getUsersMap: jest.fn(async () => ({
    '101': { name: 'Семенович В.И.', username: 'semenovich' },
    '102': { name: 'Диденко Денис', username: 'didenko' },
  })),
}));

describe('buildHistorySummaryLog', () => {
  it('игнорирует элементы истории без изменения статуса', async () => {
    const history = [
      {
        changed_at: '2025-10-06T16:59:00Z',
        changed_by: 101,
        changes: { from: { status: 'Новая' }, to: { status: 'В работе' } },
      },
      {
        changed_at: '2025-10-06T17:06:00Z',
        changed_by: 102,
        changes: {
          from: { task_type: 'Построить' },
          to: { task_type: 'Проверить' },
        },
      },
    ];
    const task = {
      request_id: 'ERM_000002',
      history,
    };

    const summary = await buildHistorySummaryLog(task as any);

    expect(summary).toContain('переведена в статус «В работе»');
    expect(summary).not.toContain('обновлена');
  });

  it('не строит историю только из первоначального статуса', async () => {
    const history = [
      {
        changed_at: '2025-10-06T15:30:00Z',
        changed_by: 101,
        changes: { to: { status: 'Новая' } },
      },
    ];
    const task = {
      request_id: 'ERM_000003',
      history,
    };

    const summary = await buildHistorySummaryLog(task as any);
    const latest = await buildLatestHistorySummary(task as any);

    expect(summary).toBeNull();
    expect(latest).toBeNull();
  });

  it('пропускает стартовое изменение и показывает последующие статусы', async () => {
    const history = [
      {
        changed_at: '2025-10-06T15:30:00Z',
        changed_by: 101,
        changes: { to: { status: 'Новая' } },
      },
      {
        changed_at: '2025-10-06T16:10:00Z',
        changed_by: 102,
        changes: { from: { status: 'Новая' }, to: { status: 'В работе' } },
      },
    ];
    const task = {
      request_id: 'ERM_000004',
      history,
    };

    const summary = await buildHistorySummaryLog(task as any);
    const latest = await buildLatestHistorySummary(task as any);

    expect(summary).toContain('переведена в статус «В работе»');
    expect(summary).not.toContain('переведена в статус «Новая»');
    expect(latest).toContain('переведена в статус «В работе»');
  });
});
