// Назначение: запрос оптимизации маршрута
// Основные модули: authFetch, shared
import authFetch from "../utils/authFetch";

export interface OptimizeTaskPayload {
  id: string;
  coordinates: { lat: number; lng: number };
  demand?: number;
  serviceMinutes?: number;
  timeWindow?: [number, number];
  title?: string;
  startAddress?: string;
  finishAddress?: string;
}

export interface OptimizeRoutePayload {
  tasks: OptimizeTaskPayload[];
  vehicleCapacity: number;
  vehicleCount: number;
  timeWindows?: Array<[number, number]>;
  averageSpeedKmph?: number;
}

export interface RouteOptimizationRouteResult {
  vehicleIndex: number;
  taskIds: string[];
  distanceKm: number;
  etaMinutes: number;
  load: number;
}

export interface RouteOptimizationResult {
  routes: RouteOptimizationRouteResult[];
  totalDistanceKm: number;
  totalEtaMinutes: number;
  totalLoad: number;
  warnings: string[];
}

export const optimizeRoute = async (
  payload: OptimizeRoutePayload,
): Promise<RouteOptimizationResult | null> => {
  const response = await authFetch("/api/v1/route-optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return (data?.result ?? null) as RouteOptimizationResult | null;
};

export default optimizeRoute;
