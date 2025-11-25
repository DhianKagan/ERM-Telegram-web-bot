// Назначение: общие интерфейсы Task и User.
// Модули: mapUtils

import type { Coords } from './mapUtils';

export type PaymentMethod = 'Наличные' | 'Карта' | 'Безнал' | 'Без оплаты';

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
  transport_driver_name?: string | null;
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
  is_bot?: boolean;
}

export type TrackingAlarmType = 'delay' | 'route-deviation';

export type TrackingAlarmSeverity = 'info' | 'warning' | 'critical';

export interface TrackingAlarmEvent {
  type: 'alarm';
  vehicleId: string;
  alarmType: TrackingAlarmType;
  message: string;
  severity: TrackingAlarmSeverity;
  occurredAt: string;
  taskId?: string;
  routeId?: string;
}

export interface TrackingPositionEvent {
  type: 'position';
  vehicleId: string;
  position: {
    lat: number;
    lon: number;
    speed?: number;
    course?: number;
    updatedAt?: string;
  };
  track?: {
    lat: number;
    lon: number;
    speed?: number;
    course?: number;
    timestamp: string;
  }[];
}

export interface TrackingHeartbeatEvent {
  type: 'heartbeat';
  timestamp: string;
}

export interface TrackingInitEvent {
  type: 'init';
  timestamp: string;
  alarms?: TrackingAlarmEvent[];
}

export type TrackingEvent =
  | TrackingAlarmEvent
  | TrackingPositionEvent
  | TrackingHeartbeatEvent
  | TrackingInitEvent;

export interface FleetVehicleDto {
  id: string;
  name: string;
  registrationNumber: string;
  odometerInitial: number;
  odometerCurrent: number;
  mileageTotal: number;
  transportType: 'Легковой' | 'Грузовой';
  fuelType: 'Бензин' | 'Дизель' | 'Газ';
  fuelRefilled: number;
  fuelAverageConsumption: number;
  fuelSpentTotal: number;
  currentTasks: string[];
  transportHistory?: {
    taskId: string;
    taskTitle?: string;
    assignedAt: string;
    removedAt?: string;
  }[];
  position?: {
    lat: number;
    lon: number;
    timestamp?: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
  unitId?: number;
  remoteName?: string;
  notes?: string;
}

export type RoutePlanStatus = 'draft' | 'approved' | 'completed';

export interface RoutePlanStop {
  order: number;
  kind: 'start' | 'finish';
  taskId: string;
  coordinates?: Coords;
  address?: string | null;
  etaMinutes?: number | null;
  delayMinutes?: number | null;
  load?: number | null;
  windowStartMinutes?: number | null;
  windowEndMinutes?: number | null;
}

export interface RoutePlanTaskRef {
  taskId: string;
  order: number;
  title?: string;
  start?: Coords;
  finish?: Coords;
  startAddress?: string | null;
  finishAddress?: string | null;
  distanceKm?: number | null;
}

export interface RoutePlanRouteMetrics {
  distanceKm?: number | null;
  tasks?: number;
  stops?: number;
  load?: number | null;
  etaMinutes?: number | null;
}

export interface RoutePlanRoute {
  id: string;
  order: number;
  vehicleId?: string | null;
  vehicleName?: string | null;
  driverId?: number | null;
  driverName?: string | null;
  tasks: RoutePlanTaskRef[];
  stops: RoutePlanStop[];
  metrics?: RoutePlanRouteMetrics;
  routeLink?: string | null;
  notes?: string | null;
}

export interface RoutePlanMetrics {
  totalDistanceKm?: number | null;
  totalRoutes: number;
  totalTasks: number;
  totalStops?: number;
  totalEtaMinutes?: number | null;
  totalLoad?: number | null;
}

export interface RoutePlan {
  id: string;
  title: string;
  status: RoutePlanStatus;
  suggestedBy?: number | null;
  method?: 'angle' | 'trip';
  count?: number;
  notes?: string | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
  completedBy?: number | null;
  completedAt?: string | null;
  metrics: RoutePlanMetrics;
  routes: RoutePlanRoute[];
  tasks: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface LogisticsInitEvent {
  type: 'logistics.init';
  timestamp: string;
}

export interface LogisticsHeartbeatEvent {
  type: 'logistics.heartbeat';
  timestamp: string;
}

export type LogisticsTaskChangeAction = 'created' | 'updated' | 'deleted';

export interface LogisticsTasksChangedEvent {
  type: 'tasks.changed';
  timestamp: string;
  action: LogisticsTaskChangeAction;
  taskIds: string[];
}

export type LogisticsRoutePlanUpdateReason =
  | 'created'
  | 'updated'
  | 'recalculated'
  | 'deleted';

export interface LogisticsRoutePlanUpdatedEvent {
  type: 'route-plan.updated';
  timestamp: string;
  reason: LogisticsRoutePlanUpdateReason;
  plan: RoutePlan;
}

export interface LogisticsRoutePlanRemovedEvent {
  type: 'route-plan.removed';
  timestamp: string;
  planId: string;
}

export type LogisticsEvent =
  | LogisticsInitEvent
  | LogisticsHeartbeatEvent
  | LogisticsTasksChangedEvent
  | LogisticsRoutePlanUpdatedEvent
  | LogisticsRoutePlanRemovedEvent;

export interface RoutePlanAnalyticsSummary {
  period: {
    from: string;
    to: string;
  };
  mileage: {
    total: number;
    byPeriod: Array<{ date: string; value: number }>;
  };
  load: {
    average: number | null;
    byPeriod: Array<{ date: string; value: number | null }>;
  };
  sla: {
    average: number | null;
    byPeriod: Array<{
      date: string;
      onTime: number;
      total: number;
      rate: number | null;
    }>;
  };
}
