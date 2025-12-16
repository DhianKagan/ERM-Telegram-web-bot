"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Роуты управления черновиками задач
// Основные модули: express, middleware/auth, auth/roles, taskDrafts.controller
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = __importDefault(require("../middleware/auth"));
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = __importDefault(require("../auth/roles.guard"));
const accessMask_1 = require("../utils/accessMask");
const di_1 = __importDefault(require("../di"));
const tokens_1 = require("../di/tokens");
const middleware_1 = require("../api/middleware");
const validate_1 = require("../utils/validate");
const router = (0, express_1.Router)();
const ctrl = di_1.default.resolve(tokens_1.TOKENS.TaskDraftsController);
router.use((0, auth_1.default)());
router.use((0, roles_decorator_1.Roles)(accessMask_1.ACCESS_USER));
router.use(roles_guard_1.default);
router.get('/:kind(task|request)', (0, middleware_1.asyncHandler)(ctrl.get));
router.put('/:kind(task|request)', [(0, express_validator_1.body)('payload').optional().isObject()], validate_1.handleValidation, (0, middleware_1.asyncHandler)(ctrl.save));
router.delete('/:kind(task|request)', (0, middleware_1.asyncHandler)(ctrl.remove));
exports.default = router;
