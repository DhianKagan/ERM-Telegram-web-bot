// Оптимизация маршрутов по координатам задач
// Модули: db/queries, services/route, services/routePlans
import * as q from '../db/queries';
import * as route from './route';
import {
  createDraftFromInputs,
  type RoutePlanRouteInput,
  type RoutePlanTaskHint,
} from './routePlans';
import type { RoutePlan as SharedRoutePlan } from 'shared';

export type OptimizeMethod = 'angle' | 'trip';

export interface TaskLike {
  _id: { toString(): string };
  startCoordinates?: { lat: number; lng: number };
  finishCoordinates?: { lat: number; lng: number };
  start_location?: string | null;
  end_location?: string | null;
  route_distance_km?: number | null;
  title?: string;
}

interface TripWaypoint {
  waypoint_index: number;
}

interface TripData {
  trips?: { waypoints: TripWaypoint[] }[];
}

export async function optimize(
  taskIds: string[],
  count = 1,
  method: OptimizeMethod = 'angle',
  actorId?: number,
): Promise<SharedRoutePlan | null> {
  count = Math.max(1, Math.min(3, Number(count) || 1));
  const tasks = (
    await Promise.all(taskIds.map((id) => q.getTask(id) as Promise<TaskLike>))
  ).filter((t) => t && t.startCoordinates);
  if (!tasks.length) return null;
  count = Math.min(count, tasks.length);

  const center = {
    lat:
      tasks.reduce((s, t) => s + (t.startCoordinates!.lat || 0), 0) /
      tasks.length,
    lng:
      tasks.reduce((s, t) => s + (t.startCoordinates!.lng || 0), 0) /
      tasks.length,
  };

  const angle = (t: TaskLike): number =>
    Math.atan2(
      t.startCoordinates!.lat - center.lat,
      t.startCoordinates!.lng - center.lng,
    );

  const sorted = tasks.sort((a, b) => angle(a) - angle(b));
  const step = Math.ceil(sorted.length / count);
  const groups: TaskLike[][] = [];
  for (let i = 0; i < count; i++) {
    groups.push(sorted.slice(i * step, (i + 1) * step));
  }

  let finalGroups = groups;

  if (method === 'trip') {
    const orderedGroups: TaskLike[][] = [];
    for (const g of groups) {
      if (g.length < 2) {
        orderedGroups.push(g);
        continue;
      }
      const points = g
        .map((t) => `${t.startCoordinates!.lng},${t.startCoordinates!.lat}`)
        .join(';');
      try {
        const data = await route.trip<TripData>(points, { roundtrip: 'false' });
        const ordered = data.trips?.[0]?.waypoints
          ? data.trips[0].waypoints.map((wp) => g[wp.waypoint_index])
          : g;
        orderedGroups.push(ordered);
      } catch {
        orderedGroups.push(g);
      }
    }
    finalGroups = orderedGroups;
  }

  const routeInputs: RoutePlanRouteInput[] = finalGroups.map((group, index) => ({
    order: index,
    tasks: group.map((task) => task._id.toString()),
  }));

  if (!routeInputs.length) {
    return null;
  }

  const hints: RoutePlanTaskHint[] = tasks.map((task) => ({
    _id: task._id,
    title: task.title,
    startCoordinates: task.startCoordinates,
    finishCoordinates: task.finishCoordinates,
    start_location: task.start_location,
    end_location: task.end_location,
    route_distance_km: task.route_distance_km,
  }));

  return createDraftFromInputs(routeInputs, { actorId, method, count }, hints);
}
