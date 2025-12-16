"use strict";
// Назначение: модель маршрутных планов с привязкой к задачам и транспорту.
// Основные модули: mongoose, shared
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoutePlan = void 0;
const mongoose_1 = require("mongoose");
const pointSchema = new mongoose_1.Schema({
    order: { type: Number, required: true },
    kind: { type: String, enum: ['start', 'via', 'finish'], required: true },
    taskId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Task', required: true },
    coordinates: { lat: Number, lng: Number },
    address: String,
    etaMinutes: Number,
    delayMinutes: Number,
    load: Number,
    windowStartMinutes: Number,
    windowEndMinutes: Number,
}, { _id: false });
const taskSchema = new mongoose_1.Schema({
    taskId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Task', required: true },
    order: { type: Number, required: true },
    title: String,
    start: { lat: Number, lng: Number },
    finish: { lat: Number, lng: Number },
    startAddress: String,
    finishAddress: String,
    distanceKm: Number,
}, { _id: false });
const routeMetricsSchema = new mongoose_1.Schema({
    distanceKm: Number,
    tasks: Number,
    stops: Number,
    load: Number,
    etaMinutes: Number,
}, { _id: false });
const routeSchema = new mongoose_1.Schema({
    id: String,
    order: { type: Number, required: true },
    vehicleId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Fleet', default: null },
    vehicleName: String,
    driverId: Number,
    driverName: String,
    notes: String,
    tasks: [taskSchema],
    stops: [pointSchema],
    metrics: routeMetricsSchema,
    routeLink: String,
}, { _id: false });
const metricsSchema = new mongoose_1.Schema({
    totalDistanceKm: Number,
    totalRoutes: { type: Number, default: 0 },
    totalTasks: { type: Number, default: 0 },
    totalStops: Number,
    totalEtaMinutes: Number,
    totalLoad: Number,
}, { _id: false });
const routePlanSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    status: {
        type: String,
        enum: ['draft', 'approved', 'completed'],
        default: 'draft',
    },
    suggestedBy: Number,
    method: { type: String, enum: ['angle', 'trip'] },
    count: Number,
    notes: String,
    approvedBy: Number,
    approvedAt: Date,
    completedBy: Number,
    completedAt: Date,
    routes: { type: [routeSchema], default: [] },
    metrics: {
        type: metricsSchema,
        default: () => ({ totalRoutes: 0, totalTasks: 0 }),
    },
    tasks: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Task' }],
}, { timestamps: true });
routePlanSchema.index({ status: 1, createdAt: -1 });
routePlanSchema.index({ 'routes.tasks.taskId': 1 });
routePlanSchema.index({ 'routes.stops.kind': 1 });
exports.RoutePlan = (0, mongoose_1.model)('RoutePlan', routePlanSchema);
