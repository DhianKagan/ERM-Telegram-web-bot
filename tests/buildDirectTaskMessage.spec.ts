/**
 * Назначение файла: проверка формирования личного сообщения о задаче.
 * Основные модули: buildDirectTaskMessage.
 */
import { buildDirectTaskMessage } from '../apps/api/src/bot/bot';

describe('buildDirectTaskMessage', () => {
  it('добавляет ссылку на веб-версию при наличии ссылки приложения', () => {
    const task = {
      _id: '507f1f77bcf86cd799439011',
      task_number: 'ERM_000002',
      title: 'Тестовая задача',
      status: 'Новая',
      assignees: [101],
    } as const;
    const users = {
      101: { name: 'Исполнитель Тестов', username: 'tester' },
    };
    const appLink =
      'https://example.com/tasks?task=507f1f77bcf86cd799439011';

    const text = buildDirectTaskMessage(task as any, null, users, appLink);

    expect(text).toContain(
      'Веб-версия: <a href="https://example.com/tasks?task=507f1f77bcf86cd799439011">Открыть задачу</a>',
    );
  });

  it('выводит примечание при передаче note', () => {
    const task = {
      _id: '507f1f77bcf86cd799439099',
      title: 'Тест',
      status: 'В работе',
      assignees: [],
    } as const;
    const text = buildDirectTaskMessage(task as any, null, {}, null, {
      note: 'Задача обновлена',
    });
    expect(text.split('\n')[0]).toBe('<i>Задача обновлена</i>');
  });
});
