import { type HydratedDocument } from 'mongoose';
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
export declare const Fleet: import("mongoose").Model<FleetVehicleAttrs, {}, {}, {}, import("mongoose").Document<unknown, {}, FleetVehicleAttrs, {}, {}> & FleetVehicleAttrs & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>;
export declare const FleetVehicle: import("mongoose").Model<FleetVehicleAttrs, {}, {}, {}, import("mongoose").Document<unknown, {}, FleetVehicleAttrs, {}, {}> & FleetVehicleAttrs & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>;
