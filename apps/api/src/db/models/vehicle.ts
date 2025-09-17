// Назначение файла: модель транспорта и связанных данных по позициям
// Основные модули: mongoose
import { Schema, model, Document, Types } from 'mongoose';

export interface VehiclePosition {
  lat: number;
  lon: number;
  speed?: number;
  course?: number;
  updatedAt?: Date;
}

export interface VehicleSensor {
  name: string;
  type?: string;
  value?: unknown;
  updatedAt?: Date;
}

export interface VehicleAttrs {
  fleetId: Types.ObjectId;
  unitId: number;
  name: string;
  remoteName?: string;
  notes?: string;
  position?: VehiclePosition;
  sensors?: VehicleSensor[];
  customSensors?: VehicleSensor[];
}

export interface VehicleDocument extends VehicleAttrs, Document {}

const positionSchema = new Schema<VehiclePosition>(
  {
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    speed: { type: Number },
    course: { type: Number },
    updatedAt: { type: Date },
  },
  { _id: false },
);

const sensorSchema = new Schema<VehicleSensor>(
  {
    name: { type: String, required: true },
    type: { type: String },
    value: { type: Schema.Types.Mixed },
    updatedAt: { type: Date },
  },
  { _id: false },
);

const vehicleSchema = new Schema<VehicleDocument>(
  {
    fleetId: { type: Schema.Types.ObjectId, ref: 'Fleet', required: true, index: true },
    unitId: { type: Number, required: true },
    name: { type: String, required: true },
    remoteName: { type: String },
    notes: { type: String, default: '' },
    position: { type: positionSchema },
    sensors: { type: [sensorSchema], default: [] },
    customSensors: { type: [sensorSchema], default: [] },
  },
  {
    timestamps: true,
  },
);

vehicleSchema.index({ fleetId: 1, unitId: 1 }, { unique: true });
vehicleSchema.index({ fleetId: 1, name: 1 });

export const Vehicle = model<VehicleDocument>('Vehicle', vehicleSchema);
