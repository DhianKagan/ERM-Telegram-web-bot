// Назначение: типы и перечисления универсальной коллекции.
// Основные модули: CollectionType, BaseItem, Employee.

export type CollectionType = 'fleets' | 'departments' | 'employees';

export interface BaseItem {
  id: string;
  name: string;
}

export interface Fleet extends BaseItem {}

export interface Department extends BaseItem {
  fleetId: string;
}

export interface Employee extends BaseItem {
  departmentId: string;
  divisionId?: string;
  positionId?: string;
}
