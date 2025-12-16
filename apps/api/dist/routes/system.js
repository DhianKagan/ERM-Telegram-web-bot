"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Назначение: маршруты управления оркестратором стека
// Основные модули: express, middleware/auth, di контейнер
const express_1 = require("express");
const auth_1 = __importDefault(require("../middleware/auth"));
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = __importDefault(require("../auth/roles.guard"));
const accessMask_1 = require("../utils/accessMask");
const middleware_1 = require("../api/middleware");
const di_1 = __importDefault(require("../di"));
const tokens_1 = require("../di/tokens");
const router = (0, express_1.Router)();
const orchestrator = di_1.default.resolve(tokens_1.TOKENS.StackOrchestratorController);
const stackHealth = di_1.default.resolve(tokens_1.TOKENS.StackHealthController);
router.get('/overview', (0, auth_1.default)(), (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_ADMIN), roles_guard_1.default, (0, middleware_1.asyncHandler)(orchestrator.overview));
router.post('/coordinate', (0, auth_1.default)(), (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_ADMIN), roles_guard_1.default, (0, middleware_1.asyncHandler)(orchestrator.coordinate));
router.get('/log-analysis/latest', (0, auth_1.default)(), (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_ADMIN), roles_guard_1.default, (0, middleware_1.asyncHandler)(orchestrator.latestLogAnalysis));
router.get('/codex-brief', (0, auth_1.default)(), (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_ADMIN), roles_guard_1.default, (0, middleware_1.asyncHandler)(orchestrator.codexBrief));
router.post('/health/run', (0, auth_1.default)(), (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_ADMIN), roles_guard_1.default, (0, middleware_1.asyncHandler)(stackHealth.run));
exports.default = router;
