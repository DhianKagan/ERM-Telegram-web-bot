/**
 * Назначение файла: проверка форматирования задач для Telegram.
 * Основные модули: formatTask, mdEscape.
 */

let formatTask: typeof import('../apps/api/src/utils/formatTask').default;
let escapeMarkdownV2: typeof import('../apps/api/src/utils/mdEscape').default;

beforeAll(async () => {
  process.env.MONGO_DATABASE_URL ||= 'mongodb://localhost:27017/ermdb';
  jest.mock('../apps/api/src/config', () => ({
    __esModule: true,
    appUrl: process.env.APP_URL || 'https://example.com',
    mongoDatabaseUrl: process.env.MONGO_DATABASE_URL!,
  }));
  ({ default: formatTask } = await import('../apps/api/src/utils/formatTask'));
  ({ default: escapeMarkdownV2 } = await import('../apps/api/src/utils/mdEscape'));
});

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
      transport_driver_id: 101,
      transport_vehicle_id: '64abc123def4567890fedcba',
      transport_vehicle_name: 'MAN TGS',
      transport_vehicle_registration: 'AA1234BB',
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
    const baseUrl = configuredUrl.replace(/\/+$/, '');
    const expectedLink = `📌 [${escapeMarkdownV2('A-12')}](${escapeMarkdownV2(
      `${baseUrl}/tasks?task=507f1f77bcf86cd799439011`,
    )})`;

    expect(text).toContain(expectedLink);
    expect(text).toContain('🧾 *Информация*');
    expect(text).toContain('⚡️ Приоритет: *🟥 Срочно*');
    expect(text).toContain('🛠 Статус: *🆕 Новая*');
    expect(text).toContain('🏷 Тип задачи: *Доставить*');
    expect(text).toContain('📣 *Доставка труб*');
    expect(text).toContain('🧭 *Логистика*');
    expect(text).toContain('🗺 Расстояние: *125 км*');
    expect(text).toContain('🚗 Транспорт: *Грузовой*');
    expect(text).toContain('🚘 Водитель: [Иван Петров](tg://user?id=101)');
    expect(text).toContain(
      `🚙 Авто: *${escapeMarkdownV2('MAN TGS (AA1234BB)')}*`,
    );
    expect(text).toContain('💳 Способ оплаты: *Безнал*');
    const formattedAmount = new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(1500);
    expect(text).toContain(`💵 Сумма: *${formattedAmount} грн*`);
    const metricFormatter = new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: 3,
      minimumFractionDigits: 0,
    });
    const weightFormatter = new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
    const dimensionsValue = `${metricFormatter.format(2.5)}×${metricFormatter.format(1.2)}×${metricFormatter.format(1)} м`;
    const volumeValue = `${metricFormatter.format(3.5)} м³`;
    const weightValue = `${weightFormatter.format(180)} кг`;
    expect(text).toContain(
      `📦 *${escapeMarkdownV2('Д×Ш×В')}*: *${escapeMarkdownV2(dimensionsValue)}*`,
    );
    expect(text).toContain(
      `📦 *${escapeMarkdownV2('Объём')}*: *${escapeMarkdownV2(volumeValue)}*`,
    );
    expect(text).toContain(
      `📦 *${escapeMarkdownV2('Вес')}*: *${escapeMarkdownV2(weightValue)}*`,
    );
    expect(text).toContain('🤝 *Участники*');
    expect(text).toContain('[Иван Петров](tg://user?id=101)');
    expect(text).toContain('[Ольга Сидорова](tg://user?id=202)');
    expect(text).toMatch(/━━━━━━━━━━━━/);
    expect(text).toContain('📝 *Описание*');
  });

  it('выстраивает заголовок в нужном порядке', () => {
    const task = {
      _id: '507f1f77bcf86cd799439041',
      task_number: 'ORD-77',
      request_id: 'REQ-77',
      title: 'Проверка формы',
      task_type: 'Контроль',
      status: 'Выполнена',
      due_date: '2024-01-01T10:00:00Z',
      completed_at: '2024-01-01T12:00:00Z',
    };

    const { text } = formatTask(task as any, {});
    const [headerSection] = text.split('\n\n━━━━━━━━━━━━\n\n');
    const headerLines = headerSection.split('\n');

    expect(headerLines.slice(0, 4)).toEqual([
      expect.stringMatching(/^📌 /),
      '🏷 Тип задачи: *Контроль*',
      '📣 *Проверка формы*',
      'Выполнена с опозданием на 2 часа',
    ]);
  });

  it('показывает галочку у статуса «Выполнена»', () => {
    const task = {
      _id: '507f1f77bcf86cd799439051',
      task_number: 'ORD-78',
      status: 'Выполнена',
    };

    const { text } = formatTask(task as any, {});

    expect(text).toContain('🛠 Статус: *✅ Выполнена*');
  });

  it('оборачивает водителя в ссылку при строковом идентификаторе', () => {
    const task = {
      _id: '64f9d82e0f4c446ce93f1fb0',
      task_number: 'B-15',
      transport_driver_id: '303',
      transport_driver_name: 'Пётр Иванов',
      logistics_enabled: true,
    };
    const users = {
      303: { name: 'Пётр Иванов', username: 'petr' },
    };

    const { text } = formatTask(task as any, users);

    expect(text).toContain('🚘 Водитель: [Пётр Иванов](tg://user?id=303)');
  });

  it('показывает имя водителя, если идентификатор отсутствует', () => {
    const task = {
      _id: '74f9d82e0f4c446ce93f1fb0',
      task_number: 'B-16',
      transport_driver_name: 'Сергей Коваленко',
      logistics_enabled: true,
    };

    const { text } = formatTask(task as any, {});

    expect(text).toContain('🚘 Водитель: *Сергей Коваленко*');
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
      task_type: textSpecial,
      task_description: `<p>${textSpecial}</p><img src="/files/demo.png" alt="${altSpecial}" />`,
    };

    const { text, inlineImages } = formatTask(task as any, {});
    const configuredUrl = process.env.APP_URL || 'https://example.com';
    const baseUrl = configuredUrl.replace(/\/+$/, '');
    const expectedUrl = `${baseUrl}/files/demo.png`;
    const inlineUrl = `${expectedUrl}?mode=inline`;

    expect(text).toContain(`📌 [${escapeMarkdownV2(textSpecial)}](`);
    expect(text).toContain(escapeMarkdownV2(textSpecial));
    expect(text).toContain(`🏷 Тип задачи: *${escapeMarkdownV2(textSpecial)}*`);
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

    expect(headerLines[0]).toMatch(/^📌 /);
    expect(headerLines[1]).toBe('📣 *Контроль сдачи отчёта*');
    expect(headerLines[2]).toBe('Выполнена с опозданием на 2 дня 2 часа');
  });

  it('корректно обрабатывает отсутствие типа задачи и названия', () => {
    const task = {
      _id: '507f1f77bcf86cd799439122',
      task_number: 'NO_*[]()TITLE',
    };

    const { text } = formatTask(task as any, {});
    const headerLines = text.split('\n');

    expect(headerLines).toHaveLength(1);
    expect(headerLines[0]).toContain('📌');
    expect(headerLines[0]).toContain(escapeMarkdownV2('NO_*[]()TITLE'));
    expect(headerLines[0]).not.toContain('Тип задачи');
    expect(headerLines[0]).not.toContain('📣');
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

  it('экранирует маркер нумерованного списка, предотвращая ошибку 400 Telegram', () => {
    const task = {
      _id: '507f1f77bcf86cd799439077',
      task_number: 'OL-01',
      task_description: '<ol><li>Первое действие</li><li>Второе действие</li></ol>',
    };

    const { text } = formatTask(task as any, {});
    const descriptionSection = text.split('📝 *Описание*')[1];

    expect(descriptionSection).toContain('1\\. Первое действие');
    expect(descriptionSection).toContain('2\\. Второе действие');
  });
});

