"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Роуты сотрудников: CRUD операции
// Модули: express, express-validator, middleware/auth, models/employee, middleware/validateDto
const express_1 = require("express");
const rateLimiter_1 = __importDefault(require("../utils/rateLimiter"));
const express_validator_1 = require("express-validator");
const auth_1 = __importDefault(require("../middleware/auth"));
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = __importDefault(require("../auth/roles.guard"));
const accessMask_1 = require("../utils/accessMask");
const validateDto_1 = __importDefault(require("../middleware/validateDto"));
const employees_dto_1 = require("../dto/employees.dto");
const employee_1 = require("../db/models/employee");
const router = (0, express_1.Router)();
const limiter = (0, rateLimiter_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    name: 'employees',
});
const middlewares = [
    (0, auth_1.default)(),
    limiter,
    (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_ADMIN),
    roles_guard_1.default,
];
router.get('/', ...middlewares, async (req, res) => {
    const fields = typeof req.query.fields === 'string'
        ? req.query.fields.split(',').join(' ')
        : undefined;
    const employees = await employee_1.Employee.find({}, fields).populate('departmentId divisionId positionId');
    res.json(employees);
});
router.post('/', ...middlewares, ...(0, validateDto_1.default)(employees_dto_1.CreateEmployeeDto), async (req, res) => {
    const employee = await employee_1.Employee.create(req.body);
    await employee.populate('departmentId divisionId positionId');
    res.status(201).json(employee);
});
router.put('/:id', ...middlewares, (0, express_validator_1.param)('id').isMongoId(), ...(0, validateDto_1.default)(employees_dto_1.UpdateEmployeeDto), async (req, res) => {
    const employee = await employee_1.Employee.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
    });
    if (!employee) {
        res.sendStatus(404);
        return;
    }
    await employee.populate('departmentId divisionId positionId');
    res.json(employee);
});
router.delete('/:id', ...middlewares, (0, express_validator_1.param)('id').isMongoId(), async (req, res) => {
    const employee = await employee_1.Employee.findByIdAndDelete(req.params.id);
    if (!employee) {
        res.sendStatus(404);
        return;
    }
    res.json({ status: 'ok' });
});
exports.default = router;
