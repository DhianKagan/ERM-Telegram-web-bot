/**
 * @jest-environment node
 */
/**
 * Назначение файла: проверка нормализации числовых полей задач.
 * Основные модули: apps/api/src/tasks/tasks.service.
 */
import type TasksServiceType from '../apps/api/src/tasks/tasks.service';
import type { TaskDocument } from '../apps/api/src/db/model';

describe('TasksService.applyCargoMetrics', () => {
  let TasksServiceCtor: typeof TasksServiceType;
  const originalRoutingUrl = process.env.ROUTING_URL;

  beforeAll(async () => {
    if (!process.env.ROUTING_URL) {
      process.env.ROUTING_URL = 'https://osrm.local/route/v1/driving/';
    }
    const module = await import('../apps/api/src/tasks/tasks.service');
    TasksServiceCtor = module.default;
  });

  afterAll(() => {
    if (originalRoutingUrl === undefined) {
      delete process.env.ROUTING_URL;
    } else {
      process.env.ROUTING_URL = originalRoutingUrl;
    }
  });

  test('парсит числа в европейском формате', () => {
    const service = new TasksServiceCtor({} as Record<string, never>);
    const payload = {
      cargo_length_m: '1,2',
      cargo_width_m: '3,4',
      cargo_height_m: '5,6',
      cargo_weight_kg: '1.234,56',
      payment_amount: '12 345,70',
      cargo_volume_m3: '0',
    } as unknown as Partial<TaskDocument>;

    service.applyCargoMetrics(payload);

    expect(payload.cargo_length_m).toBeCloseTo(1.2, 3);
    expect(payload.cargo_width_m).toBeCloseTo(3.4, 3);
    expect(payload.cargo_height_m).toBeCloseTo(5.6, 3);
    expect(payload.cargo_weight_kg).toBeCloseTo(1234.56, 2);
    expect(payload.payment_amount).toBeCloseTo(12345.7, 2);
    expect(payload.cargo_volume_m3).toBeCloseTo(22.848, 3);
  });
});
