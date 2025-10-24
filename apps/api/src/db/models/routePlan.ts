// Назначение: модель маршрутных планов с привязкой к задачам и транспорту.
// Основные модули: mongoose, shared

import { HydratedDocument, Schema, Types, model } from 'mongoose';
import type {
  RoutePlanRoute,
  RoutePlanStatus,
  RoutePlanStop,
  RoutePlanTaskRef,
} from 'shared';

export interface RoutePlanTaskEntry extends RoutePlanTaskRef {
  taskId: Types.ObjectId;
}

export interface RoutePlanStopEntry extends RoutePlanStop {
  taskId: Types.ObjectId;
}

export interface RoutePlanRouteEntry
  extends Omit<
    RoutePlanRoute,
    'tasks' | 'stops' | 'id' | 'metrics' | 'vehicleId'
  > {
  id?: string;
  vehicleId?: Types.ObjectId | null;
  tasks: RoutePlanTaskEntry[];
  stops: RoutePlanStopEntry[];
  metrics?: { distanceKm?: number | null; tasks?: number; stops?: number };
}

export interface RoutePlanAttrs {
  title: string;
  status: RoutePlanStatus;
  suggestedBy?: number | null;
  method?: 'angle' | 'trip';
  count?: number;
  notes?: string | null;
  approvedBy?: number | null;
  approvedAt?: Date | null;
  completedBy?: number | null;
  completedAt?: Date | null;
  routes: RoutePlanRouteEntry[];
  metrics: {
    totalDistanceKm?: number | null;
    totalRoutes: number;
    totalTasks: number;
    totalStops?: number;
  };
  tasks: Types.ObjectId[];
}

export type RoutePlanDocument = HydratedDocument<RoutePlanAttrs>;

const pointSchema = new Schema<RoutePlanStopEntry>(
  {
    order: { type: Number, required: true },
    kind: { type: String, enum: ['start', 'finish'], required: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    coordinates: { lat: Number, lng: Number },
    address: String,
  },
  { _id: false },
);

const taskSchema = new Schema<RoutePlanTaskEntry>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    order: { type: Number, required: true },
    title: String,
    start: { lat: Number, lng: Number },
    finish: { lat: Number, lng: Number },
    startAddress: String,
    finishAddress: String,
    distanceKm: Number,
  },
  { _id: false },
);

const routeMetricsSchema = new Schema(
  {
    distanceKm: Number,
    tasks: Number,
    stops: Number,
  },
  { _id: false },
);

const routeSchema = new Schema<RoutePlanRouteEntry>(
  {
    id: String,
    order: { type: Number, required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Fleet', default: null },
    vehicleName: String,
    driverId: Number,
    driverName: String,
    notes: String,
    tasks: [taskSchema],
    stops: [pointSchema],
    metrics: routeMetricsSchema,
    routeLink: String,
  },
  { _id: false },
);

const metricsSchema = new Schema(
  {
    totalDistanceKm: Number,
    totalRoutes: { type: Number, default: 0 },
    totalTasks: { type: Number, default: 0 },
    totalStops: Number,
  },
  { _id: false },
);

const routePlanSchema = new Schema<RoutePlanAttrs>(
  {
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
    metrics: { type: metricsSchema, default: () => ({ totalRoutes: 0, totalTasks: 0 }) },
    tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  },
  { timestamps: true },
);

routePlanSchema.index({ status: 1, createdAt: -1 });
routePlanSchema.index({ 'routes.tasks.taskId': 1 });

export const RoutePlan = model<RoutePlanDocument>('RoutePlan', routePlanSchema);
