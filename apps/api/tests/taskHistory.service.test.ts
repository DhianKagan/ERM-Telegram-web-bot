// Назначение: автотесты. Модули: jest.
const { describeAction } = require('../src/tasks/taskHistory.service.ts');

describe('describeAction', () => {
  test('форматирует изменение статуса', () => {
    const entry = {
      changes: {
        from: { status: 'Назначена' },
        to: { status: 'В работе' },
      },
    };
    expect(describeAction(entry)).toBe('статус: «Назначена» → «В работе»');
  });

  test('форматирует изменение даты', () => {
    const entry = {
      changes: {
        from: { deadline: '2023-11-01T10:00:00.000Z' },
        to: { deadline: '2023-11-02T12:30:00.000Z' },
      },
    };
    expect(describeAction(entry)).toBe(
      'срок: «01.11.2023 13:00» → «02.11.2023 15:30»',
    );
  });

  test('форматирует изменение текстового поля', () => {
    const entry = {
      changes: {
        from: { description: '  старое _значение_' },
        to: { description: 'новое значение' },
      },
    };
    expect(describeAction(entry)).toBe(
      'описание: «старое \\_значение\\_» → «новое значение»',
    );
  });
});
