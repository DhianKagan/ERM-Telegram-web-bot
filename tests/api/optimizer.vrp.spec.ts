/**
 * Назначение файла: модульные тесты оптимизации маршрутов с VRP и эвристикой.
 * Основные модули: optimizer, assert.
 */
process.env.MONGO_DATABASE_URL ||= 'mongodb://localhost:27017/ermdb';
process.env.APP_URL ||= 'https://example.com';
process.env.ROUTING_URL ||= 'https://localhost:8000/route';

import { strict as assert } from 'assert';
import type {
  OptimizeTaskInput,
  OptimizeOptions,
} from '../../apps/api/src/services/optimizer';

declare const describe: (
  name: string,
  suite: (this: unknown) => void,
) => void;
declare const it: (
  name: string,
  test: (this: unknown) => unknown | Promise<unknown>,
) => void;
declare const before: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;
declare const after: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;
declare const afterEach: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;

describe('optimizer VRP', () => {
  let optimize: typeof import('../../apps/api/src/services/optimizer').optimize;
  let optimizerTesting: typeof import('../../apps/api/src/services/optimizer').__testing;
  let originalConfigModule: NodeJS.Module | undefined;

  before(() => {
    const configModuleId = require.resolve('../../apps/api/src/config');
    originalConfigModule = require.cache[configModuleId];
    const stubExports = {
      botToken: process.env.BOT_TOKEN ?? 'test-bot-token',
      botApiUrl: undefined,
      getChatId: () => process.env.CHAT_ID ?? '0',
      chatId: process.env.CHAT_ID ?? '0',
      jwtSecret: process.env.JWT_SECRET ?? 'test-secret',
      mongoUrl: process.env.MONGO_DATABASE_URL ?? 'mongodb://localhost:27017/ermdb',
      appUrl: process.env.APP_URL ?? 'https://example.com',
      vrpOrToolsEnabled: true,
      routingUrl: process.env.ROUTING_URL ?? 'https://localhost:8000/route',
      graphhopperConfig: {
        matrixUrl: undefined,
        apiKey: undefined,
        profile: 'car',
      },
      cookieDomain: undefined,
      port: 3000,
      locale: 'ru',
      default: {
        botToken: process.env.BOT_TOKEN ?? 'test-bot-token',
        botApiUrl: undefined,
        get chatId(): string | undefined {
          return process.env.CHAT_ID ?? '0';
        },
        jwtSecret: process.env.JWT_SECRET ?? 'test-secret',
        mongoUrl: process.env.MONGO_DATABASE_URL ?? 'mongodb://localhost:27017/ermdb',
        appUrl: process.env.APP_URL ?? 'https://example.com',
        port: 3000,
        locale: 'ru',
        routingUrl: process.env.ROUTING_URL ?? 'https://localhost:8000/route',
        graphhopper: {
          matrixUrl: undefined,
          apiKey: undefined,
          profile: 'car',
        },
        cookieDomain: undefined,
        vrpOrToolsEnabled: true,
      },
    };
    require.cache[configModuleId] = {
      id: configModuleId,
      filename: configModuleId,
      loaded: true,
      exports: stubExports,
      children: [],
      paths: [],
    } as unknown as NodeJS.Module;
  });

  after(() => {
    const configModuleId = require.resolve('../../apps/api/src/config');
    if (originalConfigModule) {
      require.cache[configModuleId] = originalConfigModule;
    } else {
      delete require.cache[configModuleId];
    }
  });

  before(() => {
    // Диагностика окружения для корректного подключения конфигурации.
    if (!process.env.MONGO_DATABASE_URL) {
      throw new Error('MONGO_DATABASE_URL отсутствует перед загрузкой оптимизатора');
    }
    const module = require('../../apps/api/src/services/optimizer') as typeof import('../../apps/api/src/services/optimizer');
    optimize = module.optimize;
    optimizerTesting = module.__testing;
  });

  afterEach(() => {
    optimizerTesting.reset();
  });

  it('возвращает результат OR-Tools с метриками загрузки и ETA', async () => {
    const tasks: OptimizeTaskInput[] = [
      {
        id: 'task-1',
        coordinates: { lat: 50.45, lng: 30.52 },
        weight: 10,
        serviceMinutes: 15,
        timeWindow: [60, 180],
      },
      {
        id: 'task-2',
        coordinates: { lat: 50.46, lng: 30.53 },
        weight: 5,
        serviceMinutes: 10,
        timeWindow: [120, 240],
      },
    ];
    const options: OptimizeOptions = {
      vehicleCapacity: 25,
      vehicleCount: 1,
      averageSpeedKmph: 30,
      timeLimitSeconds: 5,
    };

    optimizerTesting.setMatrixBuilder(async () => ({
      provider: 'graphhopper',
      distanceMatrix: [
        [0, 1000, 1500],
        [1000, 0, 1200],
        [1500, 1200, 0],
      ],
      timeMatrix: [
        [0, 600, 900],
        [600, 0, 480],
        [900, 480, 0],
      ],
      warnings: [],
    }));
    optimizerTesting.setOrToolsSolver(async () => ({
      enabled: true,
      routes: [['__depot__', 'task-1', 'task-2', '__depot__']],
      totalDistanceKm: 3.7,
      totalDurationMinutes: 58,
      warnings: [],
    }));

    const result = await optimize(tasks, options);
    assert.equal(result.routes.length, 1);
    const [route] = result.routes;
    assert.deepEqual(route.taskIds, ['task-1', 'task-2']);
    assert.equal(route.load, 15);
    assert.equal(route.etaMinutes, 58);
    assert.equal(result.totalLoad, 15);
    assert.equal(result.totalEtaMinutes, 58);
    assert.equal(result.totalDistanceKm, 3.7);
    assert.equal(result.warnings.length, 0);
  });

  it('использует эвристику при ошибке движка и возвращает предупреждения', async () => {
    const tasks: OptimizeTaskInput[] = [
      {
        id: 'task-3',
        coordinates: { lat: 49.84, lng: 24.03 },
        weight: 3,
        serviceMinutes: 5,
      },
      {
        id: 'task-4',
        coordinates: { lat: 49.85, lng: 24.05 },
        weight: 2,
        serviceMinutes: 7,
      },
    ];
    const options: OptimizeOptions = {
      vehicleCapacity: 10,
      vehicleCount: 1,
      averageSpeedKmph: 35,
    };

    optimizerTesting.setMatrixBuilder(async () => ({
      provider: 'haversine',
      distanceMatrix: [
        [0, 800, 900],
        [800, 0, 700],
        [900, 700, 0],
      ],
      timeMatrix: [
        [0, 420, 480],
        [420, 0, 360],
        [480, 360, 0],
      ],
      warnings: ['GraphHopper отключён'],
    }));
    optimizerTesting.setOrToolsSolver(async () => {
      throw new Error('engine offline');
    });

    const result = await optimize(tasks, options);
    assert.equal(result.routes.length, 1);
    const [route] = result.routes;
    assert.deepEqual(route.taskIds, ['task-3', 'task-4']);
    assert.ok(route.etaMinutes > 0);
    assert.ok(route.load > 0);
    const hasEngineDrop = result.warnings.some((message) => message.includes('Падение VRP движка'));
    const hasHeuristic = result.warnings.some((message) =>
      message.toLowerCase().includes('эвристик'),
    );
    assert.ok(hasEngineDrop, `Ожидали предупреждение о падении движка, получили ${JSON.stringify(result.warnings)}`);
    assert.ok(hasHeuristic, `Ожидали предупреждение об эвристике, получили ${JSON.stringify(result.warnings)}`);
  });
});
