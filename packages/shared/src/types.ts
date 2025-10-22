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
  kind?: 'task' | 'request';
  request_id?: string;
  task_number?: string;
  completed_at?: string | null;
  in_progress_at?: string | null;
  assignees?: number[];
  cargo_length_m?: number;
  cargo_width_m?: number;
  cargo_height_m?: number;
  cargo_volume_m3?: number;
  cargo_weight_kg?: number;
  logistics_enabled?: boolean;
  transport_driver_id?: number | null;
  transport_vehicle_id?: string | null;
  transport_vehicle_name?: string | null;
  transport_vehicle_registration?: string | null;
  payment_method?: PaymentMethod;
  payment_amount?: number;
  telegram_message_id?: number;
  telegram_status_message_id?: number;
  telegram_history_message_id?: number;
  telegram_summary_message_id?: number;
  telegram_preview_message_ids?: number[];
  telegram_attachments_message_ids?: number[];
  telegram_photos_message_id?: number;
  telegram_photos_chat_id?: string | number;
  telegram_photos_topic_id?: number;
  deadline_reminder_sent_at?: string;
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
  transportHistory?: { taskId: string; taskTitle?: string; assignedAt: string; removedAt?: string }[];
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
