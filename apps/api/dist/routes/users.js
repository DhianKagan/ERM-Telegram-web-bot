"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Роуты пользователей: список, создание, GET /:id и PATCH /:id
// Модули: express, express-rate-limit, controllers/users, middleware/auth, utils/accessMask
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const di_1 = __importDefault(require("../di"));
const users_controller_1 = __importDefault(require("../users/users.controller"));
const auth_1 = __importDefault(require("../middleware/auth"));
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = __importDefault(require("../auth/roles.guard"));
const accessMask_1 = require("../utils/accessMask");
const validateDto_1 = __importDefault(require("../middleware/validateDto"));
const users_dto_1 = require("../dto/users.dto");
const router = (0, express_1.Router)();
const limiter = (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, max: 100 });
const base = [limiter, (0, auth_1.default)()];
const ctrl = di_1.default.resolve(users_controller_1.default);
router.get('/', ...base, (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_MANAGER), roles_guard_1.default, ctrl.list);
router.get('/:id', ...base, ctrl.get);
router.post('/', ...base, (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_ADMIN), roles_guard_1.default, ...(0, validateDto_1.default)(users_dto_1.CreateUserDto), ...ctrl.create);
router.patch('/:id', ...base, (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_ADMIN), roles_guard_1.default, ...(0, validateDto_1.default)(users_dto_1.UpdateUserDto), ...ctrl.update);
router.delete('/:id', ...base, (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_ADMIN), roles_guard_1.default, ...(0, validateDto_1.default)(users_dto_1.DeleteUserDto), ctrl.remove);
exports.default = router;
