/**
 * Назначение файла: проверка формирования текста истории задач.
 * Основные модули: buildHistorySummaryLog.
 */
import { buildHistorySummaryLog } from '../apps/api/src/tasks/taskMessages';

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
});
