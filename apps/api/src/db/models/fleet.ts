// Назначение файла: модель объекта автопарка
// Основные модули: mongoose
import { Schema, model, type HydratedDocument } from 'mongoose';

export type FuelType = 'Бензин' | 'Дизель' | 'Газ';

export type TransportType = 'Легковой' | 'Грузовой';

export interface VehicleTaskHistoryEntry {
  taskId: string;
  taskTitle?: string;
  assignedAt: Date;
  removedAt?: Date;
}

export interface FleetVehicleAttrs {
  name: string;
  registrationNumber: string;
  odometerInitial: number;
  odometerCurrent: number;
  mileageTotal: number;
  transportType: TransportType;
  fuelType: FuelType;
  fuelRefilled: number;
  fuelAverageConsumption: number;
  fuelSpentTotal: number;
  currentTasks: string[];
  transportHistory?: VehicleTaskHistoryEntry[];
}

export type FleetVehicleDocument = HydratedDocument<FleetVehicleAttrs>;

const vehicleTaskHistorySchema = new Schema<VehicleTaskHistoryEntry>(
  {
    taskId: { type: String, required: true },
    taskTitle: String,
    assignedAt: { type: Date, default: Date.now },
    removedAt: Date,
  },
  { _id: false },
);

const fleetVehicleSchema = new Schema<FleetVehicleAttrs>(
  {
    name: { type: String, required: true, trim: true },
    registrationNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: [/^[A-ZА-ЯІЇЄ]{2} \d{4} [A-ZА-ЯІЇЄ]{2}$/u, 'Некорректный регистрационный номер'],
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
  },
  {
    timestamps: true,
  },
);

fleetVehicleSchema.index({ name: 1 });
fleetVehicleSchema.index({ registrationNumber: 1 }, { unique: true });

export const Fleet = model<FleetVehicleAttrs>('Fleet', fleetVehicleSchema);
export const FleetVehicle = Fleet;
