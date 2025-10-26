// Назначение: типы и перечисления универсальной коллекции.
// Основные модули: CollectionType, BaseItem, Employee.

export type CollectionType = 'fleets' | 'departments' | 'employees';

export interface BaseItem {
  id: string;
  name: string;
}

export interface Fleet extends BaseItem {
  registrationNumber: string;
  odometerInitial: number;
  odometerCurrent: number;
  mileageTotal: number;
  payloadCapacityKg: number;
  fuelType: 'Бензин' | 'Дизель';
  fuelRefilled: number;
  fuelAverageConsumption: number;
  fuelSpentTotal: number;
  currentTasks: string[];
}

export interface Department extends BaseItem {
  fleetId: string;
}

export interface Employee extends BaseItem {
  departmentId: string;
  divisionId?: string;
  positionId?: string;
}
