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
