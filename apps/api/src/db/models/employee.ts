// Назначение файла: модель коллекции сотрудников
// Основные модули: mongoose
import { Schema, model, Document, Types } from 'mongoose';

export interface EmployeeAttrs {
  departmentId: Types.ObjectId;
  divisionId?: Types.ObjectId;
  positionId?: Types.ObjectId;
  name: string;
}

export interface EmployeeDocument extends EmployeeAttrs, Document {}

const employeeSchema = new Schema<EmployeeDocument>({
  departmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
  },
  divisionId: { type: Schema.Types.ObjectId, ref: 'CollectionItem' },
  positionId: { type: Schema.Types.ObjectId, ref: 'CollectionItem' },
  name: { type: String, required: true },
});

export const Employee = model<EmployeeDocument>('Employee', employeeSchema);
