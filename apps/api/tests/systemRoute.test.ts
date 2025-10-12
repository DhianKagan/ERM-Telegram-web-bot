// Назначение: проверка маршрутов оркестратора стека
// Основные модули: jest, supertest, express
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 's';

const express = require('express');
const request = require('supertest');

const mockOrchestratorController = {
  overview: jest.fn((_req: any, res: any) => res.json({ plan: [] })),
  coordinate: jest.fn((_req: any, res: any) => res.json({ executed: true })),
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
});
