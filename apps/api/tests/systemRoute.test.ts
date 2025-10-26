// Назначение: проверка маршрутов оркестратора стека
// Основные модули: jest, supertest, express
export {};

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 's';

const express = require('express');
const request = require('supertest');

const mockOrchestratorController = {
  overview: jest.fn((_req: any, res: any) =>
    res.json({
      generatedAt: '2024-01-01T00:00:00.000Z',
      fileSync: { totalFiles: 0, linkedFiles: 0, detachedFiles: 0 },
      logAnalysis: null,
    }),
  ),
  coordinate: jest.fn((_req: any, res: any) =>
    res.json({
      generatedAt: '2024-01-01T00:00:00.000Z',
      fileSync: { totalFiles: 0, linkedFiles: 0, detachedFiles: 0 },
      logAnalysis: null,
    }),
  ),
  latestLogAnalysis: jest.fn((_req: any, res: any) =>
    res.json({ summary: null }),
  ),
  codexBrief: jest.fn((_req: any, res: any) =>
    res.json({
      generatedAt: '2024-01-01T00:00:00.000Z',
      prompt: 'demo',
      fileSync: { totalFiles: 0, linkedFiles: 0, detachedFiles: 0 },
      logAnalysis: null,
    }),
  ),
};

jest.mock('../src/di', () => {
  const resolve = jest.fn(() => mockOrchestratorController);
  return {
    __esModule: true,
    default: { resolve },
    container: { resolve },
  };
});

jest.mock(
  '../src/middleware/auth',
  () => () => (_req: any, _res: any, next: any) => next(),
);
jest.mock(
  '../src/auth/roles.guard',
  () => (_req: any, _res: any, next: any) => next(),
);
jest.mock('../src/auth/roles.decorator', () => ({
  Roles: () => (_req: any, _res: any, next: any) => next(),
}));

const router = require('../src/routes/system').default;

describe('system routes', () => {
  const app = express();
  app.use(express.json());
  app.use(router);

  test('GET /overview вызывает контроллер', async () => {
    await request(app).get('/overview').expect(200);
    expect(mockOrchestratorController.overview).toHaveBeenCalled();
  });

  test('POST /coordinate вызывает контроллер', async () => {
    await request(app).post('/coordinate').expect(200);
    expect(mockOrchestratorController.coordinate).toHaveBeenCalled();
  });

  test('GET /log-analysis/latest вызывает контроллер', async () => {
    await request(app).get('/log-analysis/latest').expect(200);
    expect(mockOrchestratorController.latestLogAnalysis).toHaveBeenCalled();
  });

  test('GET /codex-brief вызывает контроллер', async () => {
    await request(app).get('/codex-brief').expect(200);
    expect(mockOrchestratorController.codexBrief).toHaveBeenCalled();
  });
});
