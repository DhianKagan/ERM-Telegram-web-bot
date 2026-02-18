// Назначение: проверка маршрутов оркестратора стека
// Основные модули: jest, supertest, express
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 's';

import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import request from 'supertest';

const mockOrchestratorController = {
  overview: jest.fn((_req: Request, res: Response) =>
    res.json({
      generatedAt: '2024-01-01T00:00:00.000Z',
      fileSync: { totalFiles: 0, linkedFiles: 0, detachedFiles: 0 },
      logAnalysis: null,
    }),
  ),
  coordinate: jest.fn((_req: Request, res: Response) =>
    res.json({
      generatedAt: '2024-01-01T00:00:00.000Z',
      fileSync: { totalFiles: 0, linkedFiles: 0, detachedFiles: 0 },
      logAnalysis: null,
    }),
  ),
  latestLogAnalysis: jest.fn((_req: Request, res: Response) =>
    res.json({ summary: null }),
  ),
  codexBrief: jest.fn((_req: Request, res: Response) =>
    res.json({
      generatedAt: '2024-01-01T00:00:00.000Z',
      prompt: 'demo',
      fileSync: { totalFiles: 0, linkedFiles: 0, detachedFiles: 0 },
      logAnalysis: null,
    }),
  ),
};

const mockQueueRecoveryService = {
  collectDiagnostics: jest.fn(async () => ({
    enabled: true,
    generatedAt: '2024-01-01T00:00:00.000Z',
    geocodingFailed: [],
    deadLetterWaiting: [],
    deadLetterFailed: [],
  })),
  recover: jest.fn(async () => ({
    enabled: true,
    dryRun: true,
    geocodingFailedScanned: 0,
    geocodingRetried: 0,
    deadLetterScanned: 0,
    deadLetterReplayed: 0,
    deadLetterRemoved: 0,
    deadLetterSkipped: 0,
    deadLetterSkippedRemoved: 0,
    errors: [],
  })),
};

jest.mock('../src/system/queueRecovery.service', () => ({
  __esModule: true,
  default: jest.fn(() => mockQueueRecoveryService),
}));

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
  () =>
    () =>
    (_req: Request, _res: Response, next: NextFunction): void =>
      next(),
);
jest.mock(
  '../src/auth/roles.guard',
  () =>
    (_req: Request, _res: Response, next: NextFunction): void =>
      next(),
);
jest.mock('../src/auth/roles.decorator', () => ({
  Roles:
    () =>
    (_req: Request, _res: Response, next: NextFunction): void =>
      next(),
}));

import router from '../src/routes/system';

describe('system routes', () => {
  const app = express();
  app.use(express.json());
  app.use(router);

  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  test('GET /queues/diagnostics вызывает сервис диагностики очередей', async () => {
    await request(app).get('/queues/diagnostics?limit=15').expect(200);

    expect(mockQueueRecoveryService.collectDiagnostics).toHaveBeenCalledWith(
      15,
    );
  });

  test('POST /queues/recover вызывает сервис восстановления очередей', async () => {
    await request(app)
      .post('/queues/recover')
      .send({
        dryRun: false,
        geocodingFailedLimit: 10,
        deadLetterLimit: 12,
        removeReplayedDeadLetter: true,
        removeSkippedDeadLetter: true,
      })
      .expect(200);

    expect(mockQueueRecoveryService.recover).toHaveBeenCalledWith({
      dryRun: false,
      geocodingFailedLimit: 10,
      deadLetterLimit: 12,
      removeReplayedDeadLetter: true,
      removeSkippedDeadLetter: true,
    });
  });
});
