// Назначение: маршруты управления оркестратором стека
// Основные модули: express, middleware/auth, di контейнер
import { Router, RequestHandler } from 'express';
import authMiddleware from '../middleware/auth';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import { ACCESS_ADMIN } from '../utils/accessMask';
import { asyncHandler } from '../api/middleware';
import container from '../di';
import { TOKENS } from '../di/tokens';
import type StackOrchestratorController from '../system/stackOrchestrator.controller';
import type StackHealthController from '../system/stackHealth.controller';
import { runS3Healthcheck } from '../services/s3Health';
import QueueRecoveryService from '../system/queueRecovery.service';

const router: Router = Router();

const orchestrator = container.resolve<StackOrchestratorController>(
  TOKENS.StackOrchestratorController,
);
const stackHealth = container.resolve<StackHealthController>(
  TOKENS.StackHealthController,
);
const queueRecovery = new QueueRecoveryService();

const parseLimit = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.min(Math.trunc(value), 200));
};

router.get(
  '/overview',
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  asyncHandler(orchestrator.overview),
);

router.post(
  '/coordinate',
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  asyncHandler(orchestrator.coordinate),
);

router.get(
  '/log-analysis/latest',
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  asyncHandler(orchestrator.latestLogAnalysis),
);

router.get(
  '/codex-brief',
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  asyncHandler(orchestrator.codexBrief),
);

router.get(
  '/health/storage',
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  asyncHandler(async (_req, res) => {
    const report = await runS3Healthcheck();
    res.status(200).json(report);
  }),
);

router.post(
  '/health/run',
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  asyncHandler(stackHealth.run),
);

router.get(
  '/queues/diagnostics',
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  asyncHandler(async (req, res) => {
    const limitQuery = req.query.limit;
    const rawLimit =
      typeof limitQuery === 'string' ? Number(limitQuery) : Number.NaN;
    const limit = parseLimit(rawLimit, 20);
    const report = await queueRecovery.collectDiagnostics(limit);
    res.status(report.enabled ? 200 : 503).json(report);
  }),
);

router.post(
  '/queues/recover',
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  asyncHandler(async (req, res) => {
    const body = req.body as Partial<{
      dryRun: boolean;
      geocodingFailedLimit: number;
      deadLetterLimit: number;
      removeReplayedDeadLetter: boolean;
      removeSkippedDeadLetter: boolean;
    }>;

    const result = await queueRecovery.recover({
      dryRun: body.dryRun,
      geocodingFailedLimit: parseLimit(body.geocodingFailedLimit, 20),
      deadLetterLimit: parseLimit(body.deadLetterLimit, 20),
      removeReplayedDeadLetter: body.removeReplayedDeadLetter === true,
      removeSkippedDeadLetter: body.removeSkippedDeadLetter === true,
    });

    res.status(result.enabled ? 200 : 503).json(result);
  }),
);

export default router;
