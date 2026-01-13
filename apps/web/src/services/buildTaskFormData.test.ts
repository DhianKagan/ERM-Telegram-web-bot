// Назначение файла: тесты функции buildTaskFormData.
// Основные модули: buildTaskFormData, FormData, Jest.
import { buildTaskFormData } from './buildTaskFormData';

describe('buildTaskFormData', () => {
  it('корректно сериализует массив вложений в JSON', () => {
    const attachments = [
      {
        fileId: 'abc123',
        name: 'Отчёт',
        type: 'application/pdf',
      },
    ];
    const formData = buildTaskFormData({
      attachments,
      assignees: [1, 2],
      assigned_user_id: '15',
      metadata: { flag: true },
    });
    expect(formData.get('formVersion')).toBe('1');
    expect(formData.getAll('assignees')).toEqual(['1', '2']);
    expect(formData.get('assigned_user_id')).toBe('15');
    expect(formData.get('attachments')).toBe(JSON.stringify(attachments));
    expect(formData.get('metadata')).toBe(JSON.stringify({ flag: true }));
  });
});
