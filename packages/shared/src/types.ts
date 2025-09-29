// Назначение: общие интерфейсы Task и User.
// Модули: отсутствуют

export type PaymentMethod =
  | 'Наличные'
  | 'Карта'
  | 'Безнал'
  | 'Без оплаты';

export interface Task {
  _id: string;
  title: string;
  status: 'Новая' | 'В работе' | 'Выполнена' | 'Отменена';
  completed_at?: string | null;
  assignees?: number[];
  cargo_length_m?: number;
  cargo_width_m?: number;
  cargo_height_m?: number;
  cargo_volume_m3?: number;
  cargo_weight_kg?: number;
  payment_method?: PaymentMethod;
  payment_amount?: number;
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

export interface FleetVehicleDto {
  id: string;
  name: string;
  registrationNumber: string;
  odometerInitial: number;
  odometerCurrent: number;
  mileageTotal: number;
  transportType: 'Легковой' | 'Грузовой';
  fuelType: 'Бензин' | 'Дизель';
  fuelRefilled: number;
  fuelAverageConsumption: number;
  fuelSpentTotal: number;
  currentTasks: string[];
  createdAt?: string;
  updatedAt?: string;
  unitId?: number;
  remoteName?: string;
  notes?: string;
  position?: VehiclePositionDto;
  sensors?: VehicleSensorDto[];
  customSensors?: VehicleSensorDto[];
  track?: VehicleTrackPointDto[];
}
