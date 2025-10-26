// Назначение: автотесты. Модули: jest.
export {};

const { describeAction } = require('../src/tasks/taskHistory.service.ts');

describe('describeAction', () => {
  test('форматирует изменение статуса', () => {
    const entry = {
      changes: {
        from: { status: 'Назначена' },
        to: { status: 'В работе' },
      },
    };
    expect(describeAction(entry)).toEqual({
      kind: 'status',
      details: 'статус: «Назначена» → «В работе»',
    });
  });

  test('форматирует изменение даты', () => {
    const entry = {
      changes: {
        from: { deadline: '2023-11-01T10:00:00.000Z' },
        to: { deadline: '2023-11-02T12:30:00.000Z' },
      },
    };
    expect(describeAction(entry)).toEqual({ kind: 'updated', details: null });
  });

  test('форматирует изменение текстового поля', () => {
    const entry = {
      changes: {
        from: { description: '  старое _значение_' },
        to: { description: 'новое значение' },
      },
    };
    expect(describeAction(entry)).toEqual({ kind: 'updated', details: null });
  });
});
