"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Роуты архива задач
// Основные модули: express, controllers/archives, middleware/auth
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const di_1 = __importDefault(require("../di"));
const archives_controller_1 = __importDefault(require("../archives/archives.controller"));
const auth_1 = __importDefault(require("../middleware/auth"));
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = __importDefault(require("../auth/roles.guard"));
const accessMask_1 = require("../utils/accessMask");
const validateDto_1 = __importDefault(require("../middleware/validateDto"));
const archives_dto_1 = require("../dto/archives.dto");
const router = (0, express_1.Router)();
const ctrl = di_1.default.resolve(archives_controller_1.default);
const ARCHIVE_ACCESS = accessMask_1.ACCESS_ADMIN | accessMask_1.ACCESS_MANAGER;
router.get('/', (0, auth_1.default)(), (0, roles_decorator_1.Roles)(ARCHIVE_ACCESS), roles_guard_1.default, (0, express_validator_1.query)('page').optional().isInt({ min: 1 }).toInt(), (0, express_validator_1.query)('limit')
    .optional()
    .isInt({ min: 1, max: 200 })
    .toInt(), (0, express_validator_1.query)('search').optional().isString().trim().isLength({ max: 200 }), ctrl.list);
router.post('/purge', (0, auth_1.default)(), (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_TASK_DELETE), roles_guard_1.default, ...(0, validateDto_1.default)(archives_dto_1.PurgeArchiveDto), ctrl.purge);
exports.default = router;
