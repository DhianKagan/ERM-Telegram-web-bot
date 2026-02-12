// Назначение: точка входа общего пакета.
// Модули: constants, taskFields, mapUtils, types, taskFormSchema

export * from './constants';
export { taskFields, type TaskField } from './taskFields';
export {
  extractCoords,
  generateRouteLink,
  generateMultiRouteLink,
  type Coords,
} from './mapUtils';
export {
  QueueName,
  QueueJobName,
  type Coordinates,
  type GeocodingJobData,
  type GeocodingJobResult,
  type RouteDistanceJobData,
  type RouteDistanceJobResult,
  type DeadLetterJobData,
} from './queues';
export type {
  Task,
  User,
  FleetVehicleDto,
  TrackingAlarmEvent,
  TrackingAlarmSeverity,
  TrackingAlarmType,
  TrackingEvent,
  TrackingHeartbeatEvent,
  TrackingInitEvent,
  TrackingPositionEvent,
  RoutePlan,
  RoutePlanMetrics,
  RoutePlanRoute,
  RoutePlanRouteMetrics,
  RoutePlanStop,
  RoutePlanTaskRef,
  RoutePlanStatus,
  TaskPoint,
  LogisticsEvent,
  LogisticsHeartbeatEvent,
  LogisticsInitEvent,
  LogisticsRoutePlanRemovedEvent,
  LogisticsRoutePlanUpdateReason,
  LogisticsRoutePlanUpdatedEvent,
  LogisticsTasksChangedEvent,
  LogisticsTaskChangeAction,
  RoutePlanAnalyticsSummary,
} from './types';
export {
  DEFAULT_MAX_SEGMENT_M,
  DEFAULT_PRECISION_DECIMALS,
  haversineDistanceMeters,
  isValidLat,
  isValidLon,
  latLngToLonLat,
  normalizePointsString,
  parsePointInput,
  precheckLocations,
  roundCoord,
  type LatLng,
  type LonLatPair,
} from './geo';
export { default as taskFormSchema } from './taskForm.schema.json';
