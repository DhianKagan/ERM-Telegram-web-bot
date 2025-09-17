// Назначение: общие интерфейсы Task и User.
// Модули: отсутствуют

export interface Task {
  _id: string;
  title: string;
  status: 'Новая' | 'В работе' | 'Выполнена' | 'Отменена';
  assignees?: number[];
  [key: string]: unknown;
}

export interface User {
  telegram_id: number;
  username: string;
  name?: string;
  phone?: string;
  mobNumber?: string;
  email?: string;
  role?: string;
  access?: number;
  roleId?: string;
  departmentId?: string;
  divisionId?: string;
  positionId?: string;
}

export interface VehiclePositionDto {
  lat: number;
  lon: number;
  speed?: number;
  course?: number;
  updatedAt?: string;
}

export interface VehicleSensorDto {
  name: string;
  type?: string;
  value?: unknown;
  updatedAt?: string;
}

export interface VehicleTrackPointDto {
  lat: number;
  lon: number;
  speed?: number;
  course?: number;
  timestamp: string;
}

export interface VehicleDto {
  id: string;
  unitId: number;
  name: string;
  remoteName?: string;
  notes?: string;
  updatedAt?: string;
  position?: VehiclePositionDto;
  sensors: VehicleSensorDto[];
  customSensors?: VehicleSensorDto[];
  track?: VehicleTrackPointDto[];
}

export interface FleetVehiclesResponse {
  fleet: { id: string; name: string };
  vehicles: VehicleDto[];
}
