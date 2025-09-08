// Назначение файла: модель коллекции департаментов
// Основные модули: mongoose
import { Schema, model, Document, Types } from 'mongoose';

export interface DepartmentAttrs {
  fleetId: Types.ObjectId;
  name: string;
}

export interface DepartmentDocument extends DepartmentAttrs, Document {}

const departmentSchema = new Schema<DepartmentDocument>({
  fleetId: { type: Schema.Types.ObjectId, ref: 'Fleet', required: true },
  name: { type: String, required: true },
});

export const Department = model<DepartmentDocument>(
  'Department',
  departmentSchema,
);
