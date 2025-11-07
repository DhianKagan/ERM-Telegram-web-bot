"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Роуты ролей: список и обновление
// Модули: express, express-validator, controllers/roles, middleware/auth
const express_1 = require("express");
const rateLimiter_1 = __importDefault(require("../utils/rateLimiter"));
const express_validator_1 = require("express-validator");
const di_1 = __importDefault(require("../di"));
const roles_controller_1 = __importDefault(require("../roles/roles.controller"));
const auth_1 = __importDefault(require("../middleware/auth"));
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = __importDefault(require("../auth/roles.guard"));
const accessMask_1 = require("../utils/accessMask");
const validateDto_1 = __importDefault(require("../middleware/validateDto"));
const roles_dto_1 = require("../dto/roles.dto");
const router = (0, express_1.Router)();
const limiter = (0, rateLimiter_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 50,
    name: 'roles',
});
const ctrl = di_1.default.resolve(roles_controller_1.default);
router.get('/', (0, auth_1.default)(), limiter, (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_ADMIN), roles_guard_1.default, ctrl.list);
router.patch('/:id', (0, auth_1.default)(), limiter, (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_ADMIN), roles_guard_1.default, (0, express_validator_1.param)('id').isMongoId(), ...(0, validateDto_1.default)(roles_dto_1.UpdateRoleDto), ctrl.update);
exports.default = router;
