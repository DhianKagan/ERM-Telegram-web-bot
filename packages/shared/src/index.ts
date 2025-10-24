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
export type {
  Task,
  User,
  FleetVehicleDto,
  VehiclePositionDto,
  VehicleSensorDto,
  VehicleTrackPointDto,
  RoutePlan,
  RoutePlanMetrics,
  RoutePlanRoute,
  RoutePlanRouteMetrics,
  RoutePlanStop,
  RoutePlanTaskRef,
  RoutePlanStatus,
} from './types';
export { default as taskFormSchema } from './taskForm.schema.json';
