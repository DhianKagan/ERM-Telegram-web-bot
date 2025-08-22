// Назначение: точка входа общего пакета.
// Модули: constants, taskFields, mapUtils, types

export * from './constants';
export { taskFields, type TaskField } from './taskFields';
export {
  extractCoords,
  generateRouteLink,
  generateMultiRouteLink,
  type Coords,
} from './mapUtils';
export type { Task, User } from './types';
