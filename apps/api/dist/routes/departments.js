"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Роуты департаментов: CRUD операции
// Модули: express, express-validator, middleware/auth, models/department, middleware/validateDto
const express_1 = require("express");
const rateLimiter_1 = __importDefault(require("../utils/rateLimiter"));
const express_validator_1 = require("express-validator");
const auth_1 = __importDefault(require("../middleware/auth"));
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = __importDefault(require("../auth/roles.guard"));
const accessMask_1 = require("../utils/accessMask");
const validateDto_1 = __importDefault(require("../middleware/validateDto"));
const departments_dto_1 = require("../dto/departments.dto");
const department_1 = require("../db/models/department");
const router = (0, express_1.Router)();
const limiter = (0, rateLimiter_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    name: 'departments',
});
const middlewares = [
    (0, auth_1.default)(),
    limiter,
    (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_ADMIN),
    roles_guard_1.default,
];
router.get('/', ...middlewares, async (_req, res) => {
    const departments = await department_1.Department.find();
    res.json(departments);
});
router.post('/', ...middlewares, ...(0, validateDto_1.default)(departments_dto_1.CreateDepartmentDto), async (req, res) => {
    const department = await department_1.Department.create(req.body);
    res.status(201).json(department);
});
router.put('/:id', ...middlewares, (0, express_validator_1.param)('id').isMongoId(), ...(0, validateDto_1.default)(departments_dto_1.UpdateDepartmentDto), async (req, res) => {
    const department = await department_1.Department.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!department) {
        res.sendStatus(404);
        return;
    }
    res.json(department);
});
router.delete('/:id', ...middlewares, (0, express_validator_1.param)('id').isMongoId(), async (req, res) => {
    const department = await department_1.Department.findByIdAndDelete(req.params.id);
    if (!department) {
        res.sendStatus(404);
        return;
    }
    res.json({ status: 'ok' });
});
exports.default = router;
