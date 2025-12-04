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

const router: Router = Router();

const orchestrator = container.resolve<StackOrchestratorController>(
  TOKENS.StackOrchestratorController,
);
const stackHealth = container.resolve<StackHealthController>(
  TOKENS.StackHealthController,
);

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

router.post(
  '/health/run',
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
  asyncHandler(stackHealth.run),
);

export default router;
