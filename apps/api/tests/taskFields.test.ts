// Назначение: автотесты. Модули: jest, supertest.
// Проверка списка полей формы задачи
// Модули: jest
process.env.NODE_ENV = 'test';
const { taskFields: fields } = require('shared');

test('содержит все обязательные поля', () => {
  const names = fields.map((f) => f.name);
  expect(names).toEqual([
    'title',
    'task_type',
    'priority',
    'creator',
    'assignees',
    'start_location',
    'transport_type',
    'cargo_length_m',
    'cargo_width_m',
    'cargo_height_m',
    'cargo_volume_m3',
    'cargo_weight_kg',
    'end_location',
    'payment_method',
    'payment_amount',
    'status',
    'description',
    'comment',
  ]);
});

test('поле title обязательно', () => {
  const title = fields.find((f) => f.name === 'title');
  expect(title.required).toBe(true);
});
