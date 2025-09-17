// Назначение файла: модель коллекции флотов
// Основные модули: mongoose
import { Schema, model, Document } from 'mongoose';

export interface FleetAttrs {
  name: string;
  token: string;
}

export interface FleetDocument extends FleetAttrs, Document {}

const fleetSchema = new Schema<FleetDocument>({
  name: { type: String, required: true },
  token: { type: String, required: true },
});

export const Fleet = model<FleetDocument>('Fleet', fleetSchema);
