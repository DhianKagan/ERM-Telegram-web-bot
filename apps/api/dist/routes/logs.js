"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Роуты логов: просмотр и запись
// Модули: express, express-validator, controllers/logs, middleware/auth
const express_1 = require("express");
const rateLimiter_1 = __importDefault(require("../utils/rateLimiter"));
const express_validator_1 = require("express-validator");
const di_1 = __importDefault(require("../di"));
const logs_controller_1 = __importDefault(require("../logs/logs.controller"));
const auth_1 = __importDefault(require("../middleware/auth"));
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = __importDefault(require("../auth/roles.guard"));
const accessMask_1 = require("../utils/accessMask");
const validateDto_1 = __importDefault(require("../middleware/validateDto"));
const logs_dto_1 = require("../dto/logs.dto");
const router = (0, express_1.Router)();
const limiter = (0, rateLimiter_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    name: 'logs',
});
const ctrl = di_1.default.resolve(logs_controller_1.default);
router.get('/', (0, auth_1.default)(), limiter, (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_ADMIN), roles_guard_1.default, (0, express_validator_1.query)('page').optional().isInt({ min: 1 }), (0, express_validator_1.query)('limit').optional().isInt({ min: 1 }), ctrl.list);
router.post('/', (0, auth_1.default)(), limiter, ...(0, validateDto_1.default)(logs_dto_1.CreateLogDto), ctrl.create);
exports.default = router;
