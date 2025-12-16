"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Роуты автопарка: CRUD операции для транспорта
// Модули: express, express-validator, middleware/auth, models/fleet
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = __importDefault(require("../middleware/auth"));
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = __importDefault(require("../auth/roles.guard"));
const accessMask_1 = require("../utils/accessMask");
const validateDto_1 = __importDefault(require("../middleware/validateDto"));
const fleets_dto_1 = require("../dto/fleets.dto");
const fleet_1 = require("../db/models/fleet");
const rateLimiter_1 = __importDefault(require("../utils/rateLimiter"));
const router = (0, express_1.Router)();
router.use((0, express_1.json)());
const limiter = (0, rateLimiter_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    name: 'fleets',
});
const middlewares = [
    (0, auth_1.default)(),
    limiter,
    (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_ADMIN),
    roles_guard_1.default,
];
const parseNumber = (value) => Number(value);
const parsePosition = (value) => {
    if (!value || typeof value !== 'object') {
        return null;
    }
    if (value === null) {
        return null;
    }
    const record = value;
    const lat = Number(record.lat);
    const lon = Number(record.lon);
    const timestampRaw = record.timestamp;
    const timestamp = timestampRaw === undefined || timestampRaw === null
        ? undefined
        : timestampRaw instanceof Date
            ? timestampRaw
            : new Date(String(timestampRaw));
    return { lat, lon, timestamp };
};
function mapVehicle(doc) {
    var _a;
    if (!doc)
        return null;
    const base = {
        id: String(doc._id),
        name: doc.name,
        registrationNumber: doc.registrationNumber,
        odometerInitial: doc.odometerInitial,
        odometerCurrent: doc.odometerCurrent,
        mileageTotal: doc.mileageTotal,
        transportType: (_a = doc.transportType) !== null && _a !== void 0 ? _a : 'Легковой',
        fuelType: doc.fuelType,
        fuelRefilled: doc.fuelRefilled,
        fuelAverageConsumption: doc.fuelAverageConsumption,
        fuelSpentTotal: doc.fuelSpentTotal,
        currentTasks: doc.currentTasks,
        position: doc.position
            ? {
                lat: Number(doc.position.lat),
                lon: Number(doc.position.lon),
                timestamp: doc.position.timestamp instanceof Date
                    ? doc.position.timestamp.toISOString()
                    : doc.position.timestamp
                        ? String(doc.position.timestamp)
                        : undefined,
            }
            : null,
        transportHistory: Array.isArray(doc.transportHistory)
            ? doc.transportHistory.map((entry) => ({
                taskId: entry.taskId,
                taskTitle: entry.taskTitle,
                assignedAt: entry.assignedAt instanceof Date
                    ? entry.assignedAt.toISOString()
                    : entry.assignedAt
                        ? String(entry.assignedAt)
                        : undefined,
                removedAt: entry.removedAt instanceof Date
                    ? entry.removedAt.toISOString()
                    : entry.removedAt
                        ? String(entry.removedAt)
                        : undefined,
            }))
            : [],
    };
    if (doc.createdAt) {
        base.createdAt =
            doc.createdAt instanceof Date
                ? doc.createdAt.toISOString()
                : String(doc.createdAt);
    }
    if (doc.updatedAt) {
        base.updatedAt =
            doc.updatedAt instanceof Date
                ? doc.updatedAt.toISOString()
                : String(doc.updatedAt);
    }
    return base;
}
router.get('/', ...middlewares, (0, express_validator_1.query)('page').optional().isInt({ min: 1 }), (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }), async (req, res) => {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const filter = search
        ? {
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { registrationNumber: { $regex: search, $options: 'i' } },
            ],
        }
        : {};
    const [docs, total] = await Promise.all([
        fleet_1.FleetVehicle.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        fleet_1.FleetVehicle.countDocuments(filter),
    ]);
    const items = docs.map((doc) => mapVehicle(doc));
    res.json({ items, total, page, limit });
});
router.post('/', ...middlewares, ...(0, validateDto_1.default)(fleets_dto_1.CreateFleetDto), async (req, res) => {
    const payload = {
        name: req.body.name,
        registrationNumber: String(req.body.registrationNumber).toUpperCase(),
        odometerInitial: parseNumber(req.body.odometerInitial),
        odometerCurrent: parseNumber(req.body.odometerCurrent),
        mileageTotal: parseNumber(req.body.mileageTotal),
        transportType: req.body.transportType,
        fuelType: req.body.fuelType,
        fuelRefilled: parseNumber(req.body.fuelRefilled),
        fuelAverageConsumption: parseNumber(req.body.fuelAverageConsumption),
        fuelSpentTotal: parseNumber(req.body.fuelSpentTotal),
        currentTasks: Array.isArray(req.body.currentTasks)
            ? req.body.currentTasks.map((task) => String(task))
            : [],
        position: parsePosition(req.body.position),
    };
    const created = await fleet_1.FleetVehicle.create(payload);
    res.status(201).json(mapVehicle(created.toObject()));
});
router.put('/:id', ...middlewares, (0, express_validator_1.param)('id').isMongoId(), ...(0, validateDto_1.default)(fleets_dto_1.UpdateFleetDto), async (req, res) => {
    const id = req.params.id;
    const update = {};
    if (typeof req.body.name === 'string')
        update.name = req.body.name;
    if (typeof req.body.registrationNumber === 'string') {
        update.registrationNumber = req.body.registrationNumber.toUpperCase();
    }
    if (req.body.odometerInitial !== undefined) {
        update.odometerInitial = parseNumber(req.body.odometerInitial);
    }
    if (req.body.odometerCurrent !== undefined) {
        update.odometerCurrent = parseNumber(req.body.odometerCurrent);
    }
    if (req.body.mileageTotal !== undefined) {
        update.mileageTotal = parseNumber(req.body.mileageTotal);
    }
    if (typeof req.body.transportType === 'string') {
        update.transportType = req.body.transportType;
    }
    if (typeof req.body.fuelType === 'string') {
        update.fuelType = req.body.fuelType;
    }
    if (req.body.fuelRefilled !== undefined) {
        update.fuelRefilled = parseNumber(req.body.fuelRefilled);
    }
    if (req.body.fuelAverageConsumption !== undefined) {
        update.fuelAverageConsumption = parseNumber(req.body.fuelAverageConsumption);
    }
    if (req.body.fuelSpentTotal !== undefined) {
        update.fuelSpentTotal = parseNumber(req.body.fuelSpentTotal);
    }
    if (Array.isArray(req.body.currentTasks)) {
        update.currentTasks = req.body.currentTasks.map((task) => String(task));
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'position')) {
        update.position = parsePosition(req.body.position);
    }
    const updated = await fleet_1.FleetVehicle.findByIdAndUpdate(id, update, {
        new: true,
    });
    if (!updated) {
        res.sendStatus(404);
        return;
    }
    res.json(mapVehicle(updated.toObject()));
});
router.delete('/:id', ...middlewares, (0, express_validator_1.param)('id').isMongoId(), async (req, res) => {
    const deleted = await fleet_1.FleetVehicle.findByIdAndDelete(req.params.id);
    if (!deleted) {
        res.sendStatus(404);
        return;
    }
    res.json({ status: 'ok' });
});
exports.default = router;
