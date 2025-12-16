"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkStatusDto = exports.AddTimeDto = exports.UpdateTaskDto = exports.CreateTaskDto = void 0;
// Назначение файла: DTO для операций с задачами
// Основные модули: routes, middleware
const express_validator_1 = require("express-validator");
const shared_1 = require("shared");
const normalizeEmptyNumeric = (value) => {
    if (typeof value === 'string' && value.trim() === '')
        return null;
    return value;
};
const normalizeEmptyString = (value) => {
    if (typeof value === 'string' && value.trim() === '')
        return null;
    return value;
};
const optionalFloatField = (field) => (0, express_validator_1.body)(field)
    .customSanitizer(normalizeEmptyNumeric)
    .optional({ nullable: true })
    .isFloat({ min: 0 });
const hasAssignedExecutor = (value) => {
    if (value === null || value === undefined)
        return false;
    if (typeof value === 'string')
        return value.trim().length > 0;
    return true;
};
const hasAssigneeList = (value) => Array.isArray(value) && value.length > 0;
const executorsRequiredMessage = 'Укажите хотя бы одного исполнителя';
const statusField = shared_1.taskFields.find((f) => f.name === 'status');
const statusList = (_a = statusField === null || statusField === void 0 ? void 0 : statusField.options) !== null && _a !== void 0 ? _a : [
    'Новая',
    'В работе',
    'Выполнена',
    'Отменена',
];
const allowedPointKinds = ['start', 'via', 'finish'];
const pointsRule = () => (0, express_validator_1.body)('points')
    .optional()
    .isArray()
    .custom((value) => {
    if (!Array.isArray(value))
        return false;
    value.forEach((point, idx) => {
        if (!point || typeof point !== 'object') {
            throw new Error(`Точка ${idx + 1} должна быть объектом`);
        }
        const payload = point;
        if (payload.kind !== undefined &&
            (typeof payload.kind !== 'string' ||
                !allowedPointKinds.includes(payload.kind.trim()))) {
            throw new Error(`Некорректный тип точки ${idx + 1}`);
        }
        if (payload.coordinates !== undefined) {
            const coords = payload.coordinates;
            const lat = Number(coords.lat);
            const lng = Number(coords.lng);
            const latValid = coords.lat === undefined ||
                (Number.isFinite(lat) && lat >= -90 && lat <= 90);
            const lngValid = coords.lng === undefined ||
                (Number.isFinite(lng) && lng >= -180 && lng <= 180);
            if (!latValid || !lngValid) {
                throw new Error(`Некорректные координаты точки ${idx + 1}`);
            }
        }
    });
    return true;
});
class CreateTaskDto {
    static rules() {
        return [
            (0, express_validator_1.body)('title').isString().notEmpty(),
            (0, express_validator_1.body)('task_description').optional().isString().isLength({ max: 4096 }),
            (0, express_validator_1.body)('status').optional().isString().isIn(statusList),
            (0, express_validator_1.body)('completed_at').optional({ nullable: true }).isISO8601(),
            (0, express_validator_1.body)('assigned_user_id')
                .customSanitizer(normalizeEmptyNumeric)
                .optional({ nullable: true })
                .isNumeric(),
            (0, express_validator_1.body)('start_date').optional().isISO8601(),
            (0, express_validator_1.body)('assignees').optional().isArray(),
            (0, express_validator_1.body)('transport_driver_id')
                .customSanitizer(normalizeEmptyNumeric)
                .optional({ nullable: true })
                .isNumeric(),
            (0, express_validator_1.body)('transport_driver_name')
                .customSanitizer(normalizeEmptyString)
                .optional({ nullable: true })
                .isString()
                .isLength({ max: 256 }),
            (0, express_validator_1.body)('transport_vehicle_id')
                .customSanitizer(normalizeEmptyString)
                .optional({ nullable: true, checkFalsy: true })
                .isMongoId(),
            (0, express_validator_1.body)()
                .custom((_value, { req }) => {
                const { assignees, assigned_user_id: assignedUserId } = req.body;
                if (hasAssigneeList(assignees) ||
                    hasAssignedExecutor(assignedUserId)) {
                    return true;
                }
                throw new Error(executorsRequiredMessage);
            })
                .withMessage(executorsRequiredMessage),
            (0, express_validator_1.body)('logistics_enabled').optional().isBoolean().toBoolean(),
            optionalFloatField('cargo_length_m'),
            optionalFloatField('cargo_width_m'),
            optionalFloatField('cargo_height_m'),
            optionalFloatField('cargo_volume_m3'),
            optionalFloatField('cargo_weight_kg'),
            optionalFloatField('payment_amount'),
            pointsRule(),
        ];
    }
}
exports.CreateTaskDto = CreateTaskDto;
class UpdateTaskDto {
    static rules() {
        return [
            (0, express_validator_1.body)('title').optional().isString(),
            (0, express_validator_1.body)('task_description').optional().isString().isLength({ max: 4096 }),
            (0, express_validator_1.body)('status').optional().isString().isIn(statusList),
            (0, express_validator_1.body)('completed_at').optional({ nullable: true }).isISO8601(),
            (0, express_validator_1.body)('assigned_user_id')
                .customSanitizer(normalizeEmptyNumeric)
                .optional({ nullable: true })
                .isNumeric(),
            (0, express_validator_1.body)('transport_driver_id')
                .customSanitizer(normalizeEmptyNumeric)
                .optional({ nullable: true })
                .isNumeric(),
            (0, express_validator_1.body)('transport_driver_name')
                .customSanitizer(normalizeEmptyString)
                .optional({ nullable: true })
                .isString()
                .isLength({ max: 256 }),
            (0, express_validator_1.body)('transport_vehicle_id')
                .customSanitizer(normalizeEmptyString)
                .optional({ nullable: true, checkFalsy: true })
                .isMongoId(),
            (0, express_validator_1.body)()
                .custom((_value, { req }) => {
                const { assignees, assigned_user_id: assignedUserId } = req.body;
                if (typeof assignees === 'undefined' &&
                    typeof assignedUserId === 'undefined') {
                    return true;
                }
                if (hasAssigneeList(assignees) ||
                    hasAssignedExecutor(assignedUserId)) {
                    return true;
                }
                throw new Error(executorsRequiredMessage);
            })
                .withMessage(executorsRequiredMessage),
            (0, express_validator_1.body)('logistics_enabled').optional().isBoolean().toBoolean(),
            optionalFloatField('cargo_length_m'),
            optionalFloatField('cargo_width_m'),
            optionalFloatField('cargo_height_m'),
            optionalFloatField('cargo_volume_m3'),
            optionalFloatField('cargo_weight_kg'),
            optionalFloatField('payment_amount'),
            pointsRule(),
        ];
    }
}
exports.UpdateTaskDto = UpdateTaskDto;
class AddTimeDto {
    static rules() {
        return [(0, express_validator_1.body)('minutes').isInt({ min: 1 })];
    }
}
exports.AddTimeDto = AddTimeDto;
class BulkStatusDto {
    static rules() {
        return [
            (0, express_validator_1.body)('ids').isArray({ min: 1 }),
            (0, express_validator_1.body)('status').isString().isIn(statusList),
        ];
    }
}
exports.BulkStatusDto = BulkStatusDto;
exports.default = {
    CreateTaskDto,
    UpdateTaskDto,
    AddTimeDto,
    BulkStatusDto,
};
