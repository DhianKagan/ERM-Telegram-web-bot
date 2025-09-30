/**
 * Назначение файла: проверка форматирования задач для Telegram.
 * Основные модули: formatTask.
 */
import formatTask from '../apps/api/src/utils/formatTask';

const escapeMd = (value: string) =>
  value.replace(/[\\_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');

describe('formatTask', () => {
  it('создаёт расширенный Markdown с кликабельным номером и секциями', () => {
    const task = {
      _id: '507f1f77bcf86cd799439011',
      task_number: 'A-12',
      request_id: 'REQ-42',
      title: 'Доставка труб',
      task_type: 'Доставить',
      start_date: '2024-03-01T06:00:00Z',
      due_date: '2024-03-02T10:30:00Z',
      priority: 'Срочно',
      status: 'Новая',
      start_location: 'Склад №1',
      start_location_link: 'https://maps.example/start',
      end_location: 'Объект «Юг»',
      route_distance_km: 125,
      transport_type: 'Грузовой',
      payment_method: 'Безнал',
      payment_amount: 1500,
      cargo_length_m: 2.5,
      cargo_width_m: 1.2,
      cargo_height_m: 1,
      cargo_volume_m3: 3.5,
      cargo_weight_kg: 180,
      assignees: [101],
      controllers: [202],
      created_by: 101,
      task_description: '<p>Необходимо доставить материалы до обеда.</p>',
    };
    const users = {
      101: { name: 'Иван Петров', username: 'ivan' },
      202: { name: 'Ольга Сидорова', username: 'olga' },
    };

    const result = formatTask(task as any, users);

    const configuredUrl = process.env.APP_URL || 'https://example.com';
    const baseUrl = escapeMd(configuredUrl.replace(/\/+$/, ''));
    const expectedLink = `📌 [${escapeMd('A-12')}](${baseUrl}/tasks/507f1f77bcf86cd799439011)`;

    expect(result).toContain(expectedLink);
    expect(result).toContain('🧾 *Информация*');
    expect(result).toContain('🧭 *Логистика*');
    expect(result).toContain('🚚 *Груз*');
    expect(result).toContain('🤝 *Участники*');
    expect(result).toContain('[Иван Петров](tg://user?id=101)');
    expect(result).toContain('[Ольга Сидорова](tg://user?id=202)');
    expect(result).toMatch(/━━━━━━━━━━━━/);
    expect(result).toContain('📝 *Описание*');
  });
});

