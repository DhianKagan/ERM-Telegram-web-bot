"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetVehicle = exports.Fleet = void 0;
// Назначение файла: модель объекта автопарка
// Основные модули: mongoose
const mongoose_1 = require("mongoose");
const vehicleTaskHistorySchema = new mongoose_1.Schema({
    taskId: { type: String, required: true },
    taskTitle: String,
    assignedAt: { type: Date, default: Date.now },
    removedAt: Date,
}, { _id: false });
const vehiclePositionSchema = new mongoose_1.Schema({
    lat: { type: Number, min: -90, max: 90, required: true },
    lon: { type: Number, min: -180, max: 180, required: true },
    timestamp: { type: Date, default: Date.now },
}, { _id: false });
const fleetVehicleSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    registrationNumber: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        match: [
            /^[A-ZА-ЯІЇЄ]{2} \d{4} [A-ZА-ЯІЇЄ]{2}$/u,
            'Некорректный регистрационный номер',
        ],
    },
    odometerInitial: { type: Number, required: true, min: 0 },
    odometerCurrent: { type: Number, required: true, min: 0 },
    mileageTotal: { type: Number, required: true, min: 0 },
    transportType: {
        type: String,
        required: true,
        enum: ['Легковой', 'Грузовой'],
        default: 'Легковой',
    },
    fuelType: {
        type: String,
        required: true,
        enum: ['Бензин', 'Дизель', 'Газ'],
    },
    fuelRefilled: { type: Number, required: true, min: 0 },
    fuelAverageConsumption: { type: Number, required: true, min: 0 },
    fuelSpentTotal: { type: Number, required: true, min: 0 },
    currentTasks: { type: [String], default: [] },
    transportHistory: { type: [vehicleTaskHistorySchema], default: [] },
    position: { type: vehiclePositionSchema, default: null },
}, {
    timestamps: true,
});
fleetVehicleSchema.index({ name: 1 });
fleetVehicleSchema.index({ registrationNumber: 1 }, { unique: true });
exports.Fleet = (0, mongoose_1.model)('Fleet', fleetVehicleSchema);
exports.FleetVehicle = exports.Fleet;
