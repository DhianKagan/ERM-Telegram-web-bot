// Назначение: модель маршрутных планов с привязкой к задачам и транспорту.
// Основные модули: mongoose, shared

import { HydratedDocument, Schema, Types, model } from 'mongoose';
import type {
  RoutePlanRoute,
  RoutePlanStatus,
  RoutePlanStop,
  RoutePlanTaskRef,
} from 'shared';

export type RoutePlanTaskEntry = Omit<RoutePlanTaskRef, 'taskId'> & {
  taskId: Types.ObjectId;
};

export type RoutePlanStopEntry = Omit<RoutePlanStop, 'taskId'> & {
  taskId: Types.ObjectId;
};

export type RoutePlanRouteEntry = Omit<
  RoutePlanRoute,
  'tasks' | 'stops' | 'vehicleId'
> & {
  id?: string;
  vehicleId?: Types.ObjectId | null;
  tasks: RoutePlanTaskEntry[];
  stops: RoutePlanStopEntry[];
  metrics?: {
    distanceKm?: number | null;
    tasks?: number;
    stops?: number;
    load?: number | null;
    etaMinutes?: number | null;
  };
};

export interface RoutePlanAttrs {
  title: string;
  status: RoutePlanStatus;
  creatorId?: number | null;
  executorId?: number | null;
  companyPointIds?: Types.ObjectId[];
  transportId?: Types.ObjectId | null;
  transportName?: string | null;
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
    totalEtaMinutes?: number | null;
    totalLoad?: number | null;
  };
  tasks: Types.ObjectId[];
}

export type RoutePlanDocument = HydratedDocument<RoutePlanAttrs>;

const pointSchema = new Schema<RoutePlanStopEntry>(
  {
    order: { type: Number, required: true },
    kind: { type: String, enum: ['start', 'via', 'finish'], required: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    coordinates: { lat: Number, lng: Number },
    address: String,
    etaMinutes: Number,
    delayMinutes: Number,
    load: Number,
    windowStartMinutes: Number,
    windowEndMinutes: Number,
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
    load: Number,
    etaMinutes: Number,
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
    totalEtaMinutes: Number,
    totalLoad: Number,
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
    creatorId: Number,
    executorId: Number,
    companyPointIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'CollectionItem' }],
      default: [],
    },
    transportId: { type: Schema.Types.ObjectId, ref: 'Fleet', default: null },
    transportName: String,
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
    tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  },
  { timestamps: true },
);

routePlanSchema.index({ status: 1, createdAt: -1 });
routePlanSchema.index({ 'routes.tasks.taskId': 1 });
routePlanSchema.index({ 'routes.stops.kind': 1 });
// Additional relationship indexes per mongoDB.md recommendations
routePlanSchema.index({ creatorId: 1 });
routePlanSchema.index({ executorId: 1 });
routePlanSchema.index({ tasks: 1 });  // Find plans containing specific task

/**
 * Referential Integrity:
 * When a RoutePlan is deleted, unassign all associated Tasks (set routePlanId to null).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleRoutePlanDeletion(doc: any) {
  if (doc && doc.tasks && doc.tasks.length > 0) {
    const taskModel = model('Task');
    await taskModel.updateMany(
      { _id: { $in: doc.tasks } },
      { $set: { routePlanId: null } },
    );
  }
}

routePlanSchema.pre('deleteOne', { document: true, query: false }, async function () {
  await handleRoutePlanDeletion(this);
});

routePlanSchema.pre('findOneAndDelete', async function () {
  const doc = await (this as any).model.findOne((this as any).getQuery());
  if (doc) {
    await handleRoutePlanDeletion(doc);
  }
});

export const RoutePlan = model<RoutePlanAttrs>('RoutePlan', routePlanSchema);
