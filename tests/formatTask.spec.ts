/**
 * Назначение файла: проверка форматирования задач для Telegram.
 * Основные модули: formatTask, mdEscape.
 */
import formatTask from '../apps/api/src/utils/formatTask';
import escapeMarkdownV2 from '../apps/api/src/utils/mdEscape';

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

    const { text } = formatTask(task as any, users);

    const configuredUrl = process.env.APP_URL || 'https://example.com';
    const baseUrl = escapeMarkdownV2(configuredUrl.replace(/\/+$/, ''));
    const expectedLink = `📌 [${escapeMarkdownV2('A-12')}](${baseUrl}/tasks/507f1f77bcf86cd799439011)`;

    expect(text).toContain(expectedLink);
    expect(text).toContain('🧾 *Информация*');
    expect(text).toContain('🧭 *Логистика*');
    expect(text).toContain('🚚 *Груз*');
    expect(text).toContain('🤝 *Участники*');
    expect(text).toContain('[Иван Петров](tg://user?id=101)');
    expect(text).toContain('[Ольга Сидорова](tg://user?id=202)');
    expect(text).toMatch(/━━━━━━━━━━━━/);
    expect(text).toContain('📝 *Описание*');
  });

  it('извлекает изображения из HTML и формирует список ссылок', () => {
    const task = {
      _id: '507f1f77bcf86cd799439011',
      task_number: 'A-12',
      task_description:
        '<p>Основной текст.</p><img src="/api/v1/files/demo.png" alt="Схема" />',
    };
    const { text, inlineImages } = formatTask(task as any, {});

    const configuredUrl = process.env.APP_URL || 'https://example.com';
    const baseUrl = configuredUrl.replace(/\/+$/, '');
    const expectedUrl = `${baseUrl}/api/v1/files/demo.png`;
    const inlineUrl = `${expectedUrl}?mode=inline`;

    expect(inlineImages).toEqual([{ url: inlineUrl, alt: 'Схема' }]);
    expect(text).toContain('📝 *Описание*');
    expect(text).toContain(escapeMarkdownV2('Основной текст.'));
    expect(text).not.toContain('🖼 *Изображение*');
    expect(text).not.toContain('<img');
  });

  it('экранирует MarkdownV2 символы в тексте, ссылках и вложениях', () => {
    const textSpecial = '_*[]()~`>#+-=|{}.!\\';
    const altSpecial = '_*[]()~-.!';
    const task = {
      _id: '65f9d82e0f4c446ce93f1fb0',
      task_number: textSpecial,
      title: textSpecial,
      task_description: `<p>${textSpecial}</p><img src="/files/demo.png" alt="${altSpecial}" />`,
    };

    const { text, inlineImages } = formatTask(task as any, {});
    const configuredUrl = process.env.APP_URL || 'https://example.com';
    const baseUrl = configuredUrl.replace(/\/+$/, '');
    const expectedUrl = `${baseUrl}/files/demo.png`;
    const inlineUrl = `${expectedUrl}?mode=inline`;

    expect(text).toContain(`📌 [${escapeMarkdownV2(textSpecial)}](`);
    expect(text).toContain(escapeMarkdownV2(textSpecial));
    expect(text).not.toContain(textSpecial);
    expect(text).not.toContain('🖼 *Изображение*');
    expect(inlineImages).toEqual([
      {
        alt: altSpecial,
        url: inlineUrl,
      },
    ]);
  });

  it('сохраняет последовательности пробелов в описании', () => {
    const task = {
      _id: '507f1f77bcf86cd799439066',
      task_number: 'SPACE-01',
      task_description: '<p>Проверяем  двойной   пробел</p>',
    };

    const { text } = formatTask(task as any, {});
    const descriptionSection = text.split('📝 *Описание*')[1];

    const expected = `Проверяем  двойной   пробел`;
    expect(descriptionSection).toContain(expected);
  });

  it('добавляет заметку о сроках выполнения для завершённой задачи', () => {
    const task = {
      _id: '507f1f77bcf86cd799439099',
      task_number: 'FIN-99',
      title: 'Контроль сдачи отчёта',
      status: 'Выполнена',
      due_date: '2024-04-01T10:00:00Z',
      completed_at: '2024-04-03T12:00:00Z',
    };

    const { text } = formatTask(task as any, {});
    const [headerSection] = text.split('\n\n━━━━━━━━━━━━\n\n');
    const headerLines = headerSection.split('\n');

    expect(headerLines[1]).toBe('Выполнена с опозданием на 2 дня 2 часа');
    expect(headerSection).toContain('Выполнена с опозданием на 2 дня 2 часа');
  });

  it('конвертирует форматирование описания из HTML в MarkdownV2', () => {
    const task = {
      _id: '507f1f77bcf86cd799439055',
      task_number: 'FMT-01',
      task_description:
        '<p><strong>Важно:</strong> завершить проверку</p><ul><li>Подготовить отчёт</li><li><em>Согласовать</em> детали</li></ul>',
    };

    const { text } = formatTask(task as any, {});
    const descriptionSection = text.split('📝 *Описание*')[1];

    expect(descriptionSection).toContain('*Важно:* завершить проверку');
    expect(descriptionSection).toContain('• Подготовить отчёт');
    expect(descriptionSection).toContain('• _Согласовать_ детали');
  });
});

