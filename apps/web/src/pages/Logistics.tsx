// Страница отображения логистики с картой, маршрутами и фильтрами
// Основные модули: React, MapLibre, i18next
import React from "react";
import fetchRouteGeometry from "../services/osrm";
import { fetchTasks } from "../services/tasks";
import optimizeRoute from "../services/optimizer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TaskTable from "../components/TaskTable";
import { useTranslation } from "react-i18next";
import maplibregl, {
  type GeoJSONSource,
  type LngLatBoundsLike,
  type Map as MapInstance,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import type * as GeoJSON from "geojson";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import useTasks from "../context/useTasks";
import { listFleetVehicles } from "../services/fleets";
import { subscribeLogisticsEvents } from "../services/logisticsEvents";
import {
  MAP_ANIMATION_SPEED_KMH,
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_MAX_BOUNDS,
  MAP_STYLE_URL,
} from "../config/map";
import {
  TASK_STATUSES,
  type Coords,
  type FleetVehicleDto,
  type RoutePlan,
  type RoutePlanStatus,
} from "shared";
import {
  listRoutePlans,
  updateRoutePlan,
  changeRoutePlanStatus,
  type RoutePlanUpdatePayload,
} from "../services/routePlans";
import type { TaskRow } from "../columns/taskColumns";
import {
  computeGeoZoneMetrics,
  isPolygonGeometry,
  pointWithinGeometry,
  type GeoZoneFeature,
} from "../utils/geozones";
import haversine from "../utils/haversine";

type RouteTask = TaskRow & {
  startCoordinates?: Coords;
  finishCoordinates?: Coords;
};

const TASK_STATUS_COLORS: Record<string, string> = {
  Новая: "#0ea5e9",
  "В работе": "#f97316",
  Выполнена: "#22c55e",
  Отменена: "#ef4444",
};

type LayerVisibilityState = {
  tasks: boolean;
  optimized: boolean;
};

const DEFAULT_LAYER_VISIBILITY: LayerVisibilityState = {
  tasks: true,
  optimized: true,
};

const LOGISTICS_EVENT_DEBOUNCE_MS =
  typeof process !== "undefined" && process.env.NODE_ENV === "test"
    ? 0
    : 400;

type TaskRouteStatusKey = RoutePlanStatus | "unassigned";
type RouteStatusFilterKey = TaskRouteStatusKey | "vehicle";

const ROUTE_STATUS_ORDER: RouteStatusFilterKey[] = [
  "draft",
  "approved",
  "completed",
  "unassigned",
  "vehicle",
];

const ROUTE_STATUS_COLORS: Record<RouteStatusFilterKey, string> = {
  draft: "#6366f1",
  approved: "#22c55e",
  completed: "#0f172a",
  unassigned: "#f97316",
  vehicle: "#0891b2",
};

const ROUTE_STATUS_LABELS: Record<RouteStatusFilterKey, string> = {
  draft: "Черновик",
  approved: "Утверждён",
  completed: "Завершён",
  unassigned: "Без маршрута",
  vehicle: "Транспорт",
};

const getRouteStatusColor = (status: RouteStatusFilterKey): string =>
  ROUTE_STATUS_COLORS[status] ?? "#0f172a";

const buildClusterStatusExpression = (status: TaskRouteStatusKey) => [
  "+",
  [
    "case",
    [
      "all",
      ["==", ["get", "entity"], "task"],
      ["==", ["get", "routeStatus"], status],
    ],
    1,
    0,
  ],
  0,
];

const CLUSTER_STATUS_PROPERTIES: Record<TaskRouteStatusKey, any> = {
  draft: buildClusterStatusExpression("draft"),
  approved: buildClusterStatusExpression("approved"),
  completed: buildClusterStatusExpression("completed"),
  unassigned: buildClusterStatusExpression("unassigned"),
};

const TRANSPORT_TYPE_COLORS: Record<string, string> = {
  Легковой: "#0ea5e9",
  Грузовой: "#f97316",
  Спецтехника: "#7c3aed",
  Пеший: "#22c55e",
  default: "#475569",
};

const TASK_TYPE_COLOR_PALETTE = [
  "#7c3aed",
  "#f97316",
  "#06b6d4",
  "#16a34a",
  "#ec4899",
  "#facc15",
  "#9333ea",
  "#0ea5e9",
];

const VEHICLE_TASK_TYPE_KEY = "vehicle";
const VEHICLE_TASK_TYPE_LABEL = "Транспорт";

type GeoZoneMetricsState = {
  areaKm2: number | null;
  perimeterKm: number | null;
  bufferMeters: number;
};

type GeoZone = {
  id: string;
  drawId: string;
  name: string;
  feature: GeoZoneFeature;
  bufferedFeature: GeoZoneFeature;
  metrics: GeoZoneMetricsState;
  createdAt: string;
};

const GEO_SOURCE_ID = "logistics-geozones";
const GEO_FILL_LAYER_ID = "logistics-geozones-fill";
const GEO_OUTLINE_LAYER_ID = "logistics-geozones-outline";
const TASK_SOURCE_ID = "logistics-task-routes";
const TASK_LAYER_ID = "logistics-task-routes-line";
const TASK_CLUSTER_SOURCE_ID = "logistics-task-markers";
const TASK_CLUSTER_LAYER_ID = "logistics-task-clusters";
const TASK_CLUSTER_COUNT_LAYER_ID = "logistics-task-cluster-count";
const TASK_POINTS_LAYER_ID = "logistics-task-points";
const TASK_ANIMATION_SOURCE_ID = "logistics-task-animation";
const TASK_ANIMATION_LAYER_ID = "logistics-task-animation-symbol";
const OPT_SOURCE_ID = "logistics-optimized-routes";
const OPT_LAYER_ID = "logistics-optimized-routes-line";

type AnyLayerSpecification = Parameters<MapInstance["addLayer"]>[0];
type LineLayerSpecification = Extract<AnyLayerSpecification, { type: "line" }>;
type SymbolLayerSpecification = Extract<AnyLayerSpecification, { type: "symbol" }>;
type CircleLayerSpecification = Extract<AnyLayerSpecification, { type: "circle" }>;

const TASK_START_SYMBOL = "⬤";
const TASK_FINISH_SYMBOL = "⦿";
const ANIMATION_SYMBOL = "▶";
const ROUTE_SPEED_KM_PER_SEC = MAP_ANIMATION_SPEED_KMH / 3600;
const MIN_ROUTE_DISTANCE_KM = 0.01;

const createEmptyCollection = <T extends GeoJSON.Geometry = GeoJSON.Geometry>(): GeoJSON.FeatureCollection<T> => ({
  type: "FeatureCollection",
  features: [],
});

const toKey = (value: string): string => value.trim().toLowerCase();

const normalizeTransportType = (raw: string): string => {
  const value = raw.trim();
  if (!value) return "Без транспорта";
  const lowered = value.toLowerCase();
  if (lowered.startsWith("лег")) return "Легковой";
  if (lowered.startsWith("груз")) return "Грузовой";
  if (lowered.includes("спец")) return "Спецтехника";
  if (lowered.includes("пеш")) return "Пеший";
  return value;
};

const normalizeTaskType = (raw: string): string => {
  const value = raw.trim();
  if (!value) return "Задача";
  if (value.length === 1) {
    return value.toUpperCase();
  }
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const getTransportColor = (transportType: string): string => {
  const normalized = normalizeTransportType(transportType);
  return (
    TRANSPORT_TYPE_COLORS[
      normalized as keyof typeof TRANSPORT_TYPE_COLORS
    ] ?? TRANSPORT_TYPE_COLORS.default
  );
};

const hexToRgb = (value: string): { r: number; g: number; b: number } | null => {
  const normalized = value.startsWith("#") ? value.slice(1) : value;
  if (normalized.length === 3) {
    const [r, g, b] = normalized.split("");
    return {
      r: parseInt(r + r, 16),
      g: parseInt(g + g, 16),
      b: parseInt(b + b, 16),
    };
  }
  if (normalized.length === 6) {
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16),
    };
  }
  return null;
};

const getContrastTextColor = (background: string): string => {
  const rgb = hexToRgb(background);
  if (!rgb) return "#ffffff";
  const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  return luminance > 186 ? "#0f172a" : "#ffffff";
};

const createMarkerImage = (
  fill: string,
  stroke: string,
  text: string,
  textColor: string,
  accent?: string,
): ImageData | null => {
  if (typeof document === "undefined") {
    return null;
  }
  const size = 96;
  const devicePixelRatio =
    typeof window !== "undefined" && window.devicePixelRatio
      ? window.devicePixelRatio
      : 1;
  const scale = devicePixelRatio > 1 ? 2 : 1;
  const canvas = document.createElement("canvas");
  canvas.width = size * scale;
  canvas.height = size * scale;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.scale(scale, scale);
  const center = size / 2;
  const radius = center - 4;
  context.clearRect(0, 0, size, size);
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.fillStyle = fill;
  context.fill();
  context.lineWidth = 6;
  context.strokeStyle = stroke;
  context.stroke();
  if (accent) {
    context.beginPath();
    context.arc(center, center, radius * 0.55, 0, Math.PI * 2);
    context.lineWidth = 4;
    context.strokeStyle = accent;
    context.stroke();
  }
  if (text) {
    context.fillStyle = textColor;
    context.font = "bold 32px 'Open Sans', 'Arial Unicode MS', sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text.slice(0, 2), center, center);
  }
  return context.getImageData(0, 0, size * scale, size * scale);
};

const buildMarkerIconId = (
  taskTypeKey: string,
  routeStatusKey: string,
  transportKey: string,
  role: string,
): string =>
  ["marker", taskTypeKey, routeStatusKey, transportKey, role]
    .map((part) => part.replace(/\s+/g, "-").toLowerCase())
    .join("-");

const ensureMarkerIcon = (
  map: MapInstance,
  cache: Set<string>,
  iconId: string,
  fill: string,
  stroke: string,
  text: string,
  textColor: string,
  accent?: string,
) => {
  if (!iconId || cache.has(iconId) || map.hasImage(iconId)) {
    cache.add(iconId);
    return;
  }
  const image = createMarkerImage(fill, stroke, text, textColor, accent);
  if (image) {
    map.addImage(iconId, image, { pixelRatio: 2 });
    cache.add(iconId);
  }
};

const toPosition = (coords?: Coords | null): [number, number] | null => {
  if (!coords) return null;
  const { lat, lng } = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return [lng, lat];
};

type AnimatedRoute = {
  taskId: string;
  title: string;
  color: string;
  coordinates: GeoJSON.Position[];
  cumulative: number[];
  total: number;
  progress: number;
};

type LogisticsDetails = {
  transport_type?: string | null;
  start_location?: string | null;
  end_location?: string | null;
};

const getTaskTransportType = (task: RouteTask): string => {
  const details =
    (task as Record<string, unknown>).logistics_details as
      | LogisticsDetails
      | undefined;
  const detailValue =
    typeof details?.transport_type === "string"
      ? details.transport_type.trim()
      : "";
  const inlineValue =
    typeof (task as Record<string, unknown>).transport_type === "string"
      ? ((task as Record<string, unknown>).transport_type as string).trim()
      : "";
  const value = detailValue || inlineValue;
  return normalizeTransportType(value);
};

const getTaskTypeLabel = (task: RouteTask): string => {
  const raw =
    typeof (task as Record<string, unknown>).task_type === "string"
      ? ((task as Record<string, unknown>).task_type as string)
      : typeof (task as Record<string, unknown>).type === "string"
        ? ((task as Record<string, unknown>).type as string)
        : "";
  return normalizeTaskType(raw);
};

const getTaskTypeInitial = (label: string): string => {
  if (!label) return "З";
  const trimmed = label.trim();
  if (!trimmed) return "З";
  return trimmed.charAt(0).toUpperCase();
};

const getVehicleCoordinates = (vehicle: FleetVehicleDto): [number, number] | null => {
  const position = (vehicle as Record<string, unknown>).position as
    | { lat?: number; lon?: number; lng?: number; long?: number }
    | undefined;
  if (!position) return null;
  const latCandidate =
    typeof position.lat === "number"
      ? position.lat
      : typeof (position as Record<string, unknown>).latitude === "number"
        ? ((position as Record<string, unknown>).latitude as number)
        : null;
  const lonCandidate =
    typeof position.lon === "number"
      ? position.lon
      : typeof position.lng === "number"
        ? position.lng
        : typeof position.long === "number"
          ? position.long
          : typeof (position as Record<string, unknown>).longitude === "number"
            ? ((position as Record<string, unknown>).longitude as number)
            : null;
  if (
    latCandidate === null ||
    lonCandidate === null ||
    !Number.isFinite(latCandidate) ||
    !Number.isFinite(lonCandidate)
  ) {
    return null;
  }
  return [lonCandidate, latCandidate];
};

const filterTasksByGeoZones = (
  tasks: RouteTask[],
  zones: GeoZone[],
  activeZoneIds: string[],
): RouteTask[] => {
  if (!zones.length || !activeZoneIds.length) {
    return tasks;
  }
  const activeZones = zones.filter((zone) => activeZoneIds.includes(zone.id));
  if (!activeZones.length) {
    return tasks;
  }
  return tasks.filter((task) => {
    const points: [number, number][] = [];
    const start = toPosition(task.startCoordinates);
    const finish = toPosition(task.finishCoordinates);
    if (start) points.push(start);
    if (finish) points.push(finish);
    if (!points.length) {
      return false;
    }
    return points.some((point) =>
      activeZones.some((zone) => {
        const geometry = isPolygonGeometry(zone.bufferedFeature.geometry)
          ? zone.bufferedFeature.geometry
          : isPolygonGeometry(zone.feature.geometry)
            ? zone.feature.geometry
            : null;
        if (!geometry) {
          return false;
        }
        return pointWithinGeometry(point, geometry);
      }),
    );
  });
};

const toLatLng = (position: GeoJSON.Position): { lat: number; lng: number } => ({
  lng: position[0],
  lat: position[1],
});

const computeBearing = (from: GeoJSON.Position, to: GeoJSON.Position): number => {
  const fromLat = (from[1] * Math.PI) / 180;
  const toLat = (to[1] * Math.PI) / 180;
  const deltaLng = ((to[0] - from[0]) * Math.PI) / 180;
  const y = Math.sin(deltaLng) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);
  const radians = Math.atan2(y, x);
  const degrees = (radians * 180) / Math.PI;
  return (degrees + 360) % 360;
};

const createAnimatedRoute = (
  coordinates: GeoJSON.Position[],
  color: string,
  taskId: string,
  title: string,
): AnimatedRoute | null => {
  if (coordinates.length < 2) {
    return null;
  }
  const cumulative: number[] = [0];
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const prev = coordinates[index - 1];
    const next = coordinates[index];
    const distance = haversine(toLatLng(prev), toLatLng(next));
    total += distance;
    cumulative.push(total);
  }
  if (total < MIN_ROUTE_DISTANCE_KM) {
    return null;
  }
  return {
    taskId,
    title,
    color,
    coordinates,
    cumulative,
    total,
    progress: 0,
  };
};

const getAnimationPoint = (
  route: AnimatedRoute,
  distance: number,
): { position: GeoJSON.Position; bearing: number } => {
  const capped = Math.max(0, Math.min(distance, route.total));
  const { cumulative, coordinates } = route;
  let segmentIndex = 0;
  for (let index = 0; index < cumulative.length - 1; index += 1) {
    if (capped >= cumulative[index] && capped <= cumulative[index + 1]) {
      segmentIndex = index;
      break;
    }
  }
  const start = coordinates[segmentIndex];
  const end = coordinates[segmentIndex + 1] ?? coordinates[segmentIndex];
  const segmentStart = cumulative[segmentIndex];
  const segmentEnd = cumulative[segmentIndex + 1] ?? route.total;
  const segmentDistance = segmentEnd - segmentStart;
  const t = segmentDistance > 0 ? (capped - segmentStart) / segmentDistance : 0;
  const lng = start[0] + (end[0] - start[0]) * t;
  const lat = start[1] + (end[1] - start[1]) * t;
  return {
    position: [lng, lat],
    bearing: computeBearing(start, end),
  };
};

type BuildGeoZoneOptions = {
  id: string;
  drawId: string;
  name: string;
  createdAt: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  properties?: GeoJSON.GeoJsonProperties;
  active: boolean;
  bufferMeters?: number;
};

const buildGeoZone = ({
  id,
  drawId,
  name,
  createdAt,
  geometry,
  properties = {},
  active,
  bufferMeters,
}: BuildGeoZoneOptions): GeoZone => {
  const baseProperties: GeoJSON.GeoJsonProperties = {
    ...properties,
    zoneId: id,
    active,
  };
  const baseFeature: GeoZoneFeature = {
    type: "Feature",
    geometry,
    properties: baseProperties,
  };
  const metricsResult = computeGeoZoneMetrics(baseFeature, bufferMeters);
  const metricsProperties: GeoJSON.GeoJsonProperties = {
    ...baseProperties,
    areaKm2: metricsResult.areaKm2 ?? undefined,
    perimeterKm: metricsResult.perimeterKm ?? undefined,
    bufferMeters: metricsResult.bufferMeters,
  };
  const feature: GeoZoneFeature = {
    type: "Feature",
    geometry,
    properties: metricsProperties,
  };
  const bufferedFeature: GeoZoneFeature = {
    type: "Feature",
    geometry: metricsResult.bufferedGeometry,
    properties: metricsProperties,
  };
  return {
    id,
    drawId,
    name,
    createdAt,
    feature,
    bufferedFeature,
    metrics: {
      areaKm2: metricsResult.areaKm2,
      perimeterKm: metricsResult.perimeterKm,
      bufferMeters: metricsResult.bufferMeters,
    },
  };
};

const MAP_CENTER_LNG_LAT: [number, number] = [
  MAP_DEFAULT_CENTER[1],
  MAP_DEFAULT_CENTER[0],
];
const UKRAINE_BOUNDS: LngLatBoundsLike = MAP_MAX_BOUNDS;

export default function LogisticsPage() {
  const { t, i18n } = useTranslation();
  const tRef = React.useRef(t);
  React.useEffect(() => {
    tRef.current = t;
  }, [t]);
  const language = i18n.language;
  const [sorted, setSorted] = React.useState<RouteTask[]>([]);
  const [allRouteTasks, setAllRouteTasks] = React.useState<RouteTask[]>([]);
  const [vehicles, setVehicles] = React.useState(1);
  const [method, setMethod] = React.useState("angle");
  const [links, setLinks] = React.useState<string[]>([]);
  const [plan, setPlan] = React.useState<RoutePlan | null>(null);
  const [planDraft, setPlanDraft] = React.useState<RoutePlan | null>(null);
  const [planMessage, setPlanMessage] = React.useState("");
  const [planMessageTone, setPlanMessageTone] = React.useState<
    "neutral" | "error" | "success"
  >("neutral");
  const [planLoading, setPlanLoading] = React.useState(false);
  const mapRef = React.useRef<MapInstance | null>(null);
  const drawRef = React.useRef<MapboxDraw | null>(null);
  const [mapViewMode, setMapViewMode] = React.useState<
    "planar" | "perspective"
  >("planar");
  const routeAnimationRef = React.useRef<{
    frameId: number | null;
    lastTimestamp: number | null;
    routes: AnimatedRoute[];
  }>({ frameId: null, lastTimestamp: null, routes: [] });
  const [availableVehicles, setAvailableVehicles] = React.useState<
    FleetVehicleDto[]
  >([]);
  const [fleetError, setFleetError] = React.useState("");
  const [vehiclesHint, setVehiclesHint] = React.useState("");
  const [vehiclesLoading, setVehiclesLoading] = React.useState(false);
  const [layerVisibility, setLayerVisibility] = React.useState<LayerVisibilityState>(
    DEFAULT_LAYER_VISIBILITY,
  );
  const [mapReady, setMapReady] = React.useState(false);
  const [hiddenTaskTypes, setHiddenTaskTypes] = React.useState<string[]>([]);
  const [hiddenRouteStatuses, setHiddenRouteStatuses] = React.useState<
    RouteStatusFilterKey[]
  >([]);
  const [hiddenTransportTypes, setHiddenTransportTypes] = React.useState<string[]>([]);
  const [clusterSelection, setClusterSelection] = React.useState<{
    ids: string[];
    center: GeoJSON.Position | null;
  } | null>(null);
  const [geoZones, setGeoZones] = React.useState<GeoZone[]>([]);
  const [activeGeoZoneIds, setActiveGeoZoneIds] = React.useState<string[]>([]);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [optimizedRoutesGeoJSON, setOptimizedRoutesGeoJSON] = React.useState<
    GeoJSON.FeatureCollection<GeoJSON.LineString>
  >(createEmptyCollection<GeoJSON.LineString>());
  const [page, setPage] = React.useState(0);
  const hasLoadedFleetRef = React.useRef(false);
  const markerIconCacheRef = React.useRef<Set<string>>(new Set());
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const hasDialog = params.has("task") || params.has("newTask");
  const { user } = useAuth();
  const { controller } = useTasks();
  const role = user?.role ?? null;
  const vehiclesWithCoordinates = React.useMemo(
    () =>
      availableVehicles.filter(
        (vehicle) => getVehicleCoordinates(vehicle) !== null,
      ),
    [availableVehicles],
  );
  const hiddenTaskTypesSet = React.useMemo(
    () => new Set(hiddenTaskTypes),
    [hiddenTaskTypes],
  );
  const hiddenRouteStatusesSet = React.useMemo(
    () => new Set(hiddenRouteStatuses),
    [hiddenRouteStatuses],
  );
  const hiddenTransportTypesSet = React.useMemo(
    () => new Set(hiddenTransportTypes),
    [hiddenTransportTypes],
  );
  const selectedTaskIdsSet = React.useMemo(
    () => new Set(clusterSelection?.ids ?? []),
    [clusterSelection],
  );

  const filteredTasksByZone = React.useMemo(
    () => filterTasksByGeoZones(allRouteTasks, geoZones, activeGeoZoneIds),
    [activeGeoZoneIds, allRouteTasks, geoZones],
  );

  const taskRouteStatusMap = React.useMemo(() => {
    const map = new Map<string, TaskRouteStatusKey>();
    const registerPlan = (source: RoutePlan | null) => {
      if (!source) return;
      const status: RoutePlanStatus = source.status ?? "draft";
      source.routes.forEach((route) => {
        route.tasks.forEach((taskRef) => {
          const idCandidate =
            typeof taskRef.taskId === "string"
              ? taskRef.taskId
              : typeof (taskRef as Record<string, unknown>).task_id === "string"
                ? ((taskRef as Record<string, unknown>).task_id as string)
                : null;
          if (!idCandidate) return;
          map.set(idCandidate, status);
        });
      });
    };
    registerPlan(planDraft ?? null);
    if (plan) {
      registerPlan(plan);
    }
    return map;
  }, [plan, planDraft]);

  const categoryFilteredTasks = React.useMemo(() => {
    return filteredTasksByZone.filter((task) => {
      const routeStatus = (taskRouteStatusMap.get(task._id) ?? "unassigned") as RouteStatusFilterKey;
      if (hiddenRouteStatusesSet.has(routeStatus)) {
        return false;
      }
      const transportLabel = getTaskTransportType(task);
      const transportKey = toKey(transportLabel);
      if (hiddenTransportTypesSet.has(transportKey)) {
        return false;
      }
      const typeLabel = getTaskTypeLabel(task);
      const typeKey = toKey(typeLabel);
      if (hiddenTaskTypesSet.has(typeKey)) {
        return false;
      }
      return true;
    });
  }, [
    filteredTasksByZone,
    hiddenRouteStatusesSet,
    hiddenTaskTypesSet,
    hiddenTransportTypesSet,
    taskRouteStatusMap,
  ]);

  const taskStatus = React.useMemo(() => {
    const counts: Record<string, number> = {};
    categoryFilteredTasks.forEach((task) => {
      const rawStatus =
        typeof task.status === "string" && task.status.trim()
          ? task.status.trim()
          : "Новая";
      counts[rawStatus] = (counts[rawStatus] ?? 0) + 1;
    });
    return counts;
  }, [categoryFilteredTasks]);

  const routeStatusMetadata = React.useMemo(() => {
    const entries = new Map<RouteStatusFilterKey, { count: number; color: string }>();
    ROUTE_STATUS_ORDER.forEach((key) => {
      entries.set(key, { count: 0, color: getRouteStatusColor(key) });
    });
    filteredTasksByZone.forEach((task) => {
      const statusKey = (taskRouteStatusMap.get(task._id) ?? "unassigned") as RouteStatusFilterKey;
      const entry = entries.get(statusKey);
      if (entry) {
        entry.count += 1;
      } else {
        entries.set(statusKey, {
          count: 1,
          color: getRouteStatusColor(statusKey),
        });
      }
    });
    if (vehiclesWithCoordinates.length) {
      const entry = entries.get("vehicle");
      if (entry) {
        entry.count += vehiclesWithCoordinates.length;
      } else {
        entries.set("vehicle", {
          count: vehiclesWithCoordinates.length,
          color: getRouteStatusColor("vehicle"),
        });
      }
    }
    return entries;
  }, [filteredTasksByZone, taskRouteStatusMap, vehiclesWithCoordinates]);

  const transportMetadata = React.useMemo(() => {
    const entries = new Map<string, { label: string; count: number; color: string }>();
    filteredTasksByZone.forEach((task) => {
      const label = getTaskTransportType(task);
      const normalized = normalizeTransportType(label);
      const key = toKey(normalized);
      const color = getTransportColor(normalized);
      const entry = entries.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        entries.set(key, { label: normalized, count: 1, color });
      }
    });
    vehiclesWithCoordinates.forEach((vehicle) => {
      const label = normalizeTransportType(vehicle.transportType ?? "");
      const key = toKey(label);
      const color = getTransportColor(label);
      const entry = entries.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        entries.set(key, { label, count: 1, color });
      }
    });
    return entries;
  }, [filteredTasksByZone, vehiclesWithCoordinates]);

  const taskTypeMetadata = React.useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    filteredTasksByZone.forEach((task) => {
      const label = getTaskTypeLabel(task);
      const key = toKey(label);
      const entry = counts.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        counts.set(key, { label, count: 1 });
      }
    });
    if (vehiclesWithCoordinates.length) {
      counts.set(VEHICLE_TASK_TYPE_KEY, {
        label: VEHICLE_TASK_TYPE_LABEL,
        count: vehiclesWithCoordinates.length,
      });
    }
    const sortedKeys = Array.from(counts.keys()).sort();
    const entries = new Map<string, { label: string; count: number; color: string }>();
    sortedKeys.forEach((key, index) => {
      const meta = counts.get(key);
      if (!meta) return;
      const color = TASK_TYPE_COLOR_PALETTE[index % TASK_TYPE_COLOR_PALETTE.length];
      entries.set(key, { label: meta.label, count: meta.count, color });
    });
    return entries;
  }, [filteredTasksByZone, vehiclesWithCoordinates]);

  const routeStatusEntries = React.useMemo(
    () =>
      ROUTE_STATUS_ORDER.map((key) => ({
        key,
        count: routeStatusMetadata.get(key)?.count ?? 0,
        color: getRouteStatusColor(key),
      })),
    [routeStatusMetadata],
  );

  const transportEntries = React.useMemo(
    () =>
      Array.from(transportMetadata.entries())
        .sort((a, b) => a[1].label.localeCompare(b[1].label))
        .map(([key, value]) => ({ key, ...value })),
    [transportMetadata],
  );

  const taskTypeEntries = React.useMemo(
    () => Array.from(taskTypeMetadata.entries()).map(([key, value]) => ({ key, ...value })),
    [taskTypeMetadata],
  );

  const taskPointsGeoJSON = React.useMemo(() => {
    const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
    const appendFeature = (
      coordinates: [number, number],
      properties: GeoJSON.GeoJsonProperties,
    ) => {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates },
        properties,
      });
    };
    categoryFilteredTasks.forEach((task) => {
      const routeStatus = (taskRouteStatusMap.get(task._id) ?? "unassigned") as TaskRouteStatusKey;
      const routeStatusKey: RouteStatusFilterKey = routeStatus;
      const routeColor = getRouteStatusColor(routeStatusKey);
      const transportLabel = getTaskTransportType(task);
      const transportKey = toKey(transportLabel);
      const transportColor = getTransportColor(transportLabel);
      const typeLabel = getTaskTypeLabel(task);
      const typeKey = toKey(typeLabel);
      const typeColor = taskTypeMetadata.get(typeKey)?.color ?? "#334155";
      const iconText = getTaskTypeInitial(typeLabel);
      const textColor = getContrastTextColor(transportColor);
      const title = task.title ?? task._id;
      const label = title.length > 28 ? `${title.slice(0, 25)}…` : title;
      const isSelected = selectedTaskIdsSet.has(task._id);
      const start = toPosition(task.startCoordinates);
      const finish = toPosition(task.finishCoordinates);
      if (start) {
        const iconId = buildMarkerIconId(typeKey, routeStatusKey, transportKey, "start");
        appendFeature(start, {
          entity: "task",
          taskId: task._id,
          title,
          label,
          routeStatus: routeStatusKey,
          transportType: transportLabel,
          taskType: typeLabel,
          pointRole: "start",
          iconId,
          iconFill: transportColor,
          iconStroke: routeColor,
          iconText,
          iconTextColor: textColor,
          iconAccent: typeColor,
          selected: isSelected,
        });
      }
      if (finish) {
        const iconId = buildMarkerIconId(typeKey, routeStatusKey, transportKey, "finish");
        appendFeature(finish, {
          entity: "task",
          taskId: task._id,
          title,
          label,
          routeStatus: routeStatusKey,
          transportType: transportLabel,
          taskType: typeLabel,
          pointRole: "finish",
          iconId,
          iconFill: transportColor,
          iconStroke: routeColor,
          iconText,
          iconTextColor: textColor,
          iconAccent: typeColor,
          selected: isSelected,
        });
      }
    });
    vehiclesWithCoordinates.forEach((vehicle) => {
      const coordinates = getVehicleCoordinates(vehicle);
      if (!coordinates) return;
      const transportLabel = normalizeTransportType(vehicle.transportType ?? "");
      const transportKey = toKey(transportLabel);
      const routeStatusKey: RouteStatusFilterKey = "vehicle";
      if (hiddenRouteStatusesSet.has(routeStatusKey)) return;
      if (hiddenTransportTypesSet.has(transportKey)) return;
      if (hiddenTaskTypesSet.has(VEHICLE_TASK_TYPE_KEY)) return;
      const transportColor = getTransportColor(transportLabel);
      const iconText = getTaskTypeInitial(VEHICLE_TASK_TYPE_LABEL);
      const textColor = getContrastTextColor(transportColor);
      const typeColor =
        taskTypeMetadata.get(VEHICLE_TASK_TYPE_KEY)?.color ?? "#0f172a";
      const iconId = buildMarkerIconId(
        VEHICLE_TASK_TYPE_KEY,
        routeStatusKey,
        transportKey,
        "vehicle",
      );
      const title = vehicle.name;
      const label = title.length > 28 ? `${title.slice(0, 25)}…` : title;
      appendFeature(coordinates, {
        entity: "vehicle",
        vehicleId: vehicle.id,
        title,
        label,
        routeStatus: routeStatusKey,
        transportType: transportLabel,
        taskType: VEHICLE_TASK_TYPE_LABEL,
        pointRole: "vehicle",
        iconId,
        iconFill: transportColor,
        iconStroke: getRouteStatusColor(routeStatusKey),
        iconText,
        iconTextColor: textColor,
        iconAccent: typeColor,
        selected: false,
      });
    });
    return {
      type: "FeatureCollection" as const,
      features,
    } satisfies GeoJSON.FeatureCollection<GeoJSON.Point>;
  }, [
    categoryFilteredTasks,
    hiddenRouteStatusesSet,
    hiddenTaskTypesSet,
    hiddenTransportTypesSet,
    selectedTaskIdsSet,
    taskRouteStatusMap,
    taskTypeMetadata,
    vehiclesWithCoordinates,
  ]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(TASK_CLUSTER_SOURCE_ID) as
      | GeoJSONSource
      | undefined;
    if (!source) return;
    taskPointsGeoJSON.features.forEach((feature) => {
      const iconId = feature.properties?.iconId;
      if (typeof iconId !== "string" || !iconId) return;
      const fill =
        typeof feature.properties?.iconFill === "string"
          ? (feature.properties.iconFill as string)
          : "#2563eb";
      const stroke =
        typeof feature.properties?.iconStroke === "string"
          ? (feature.properties.iconStroke as string)
          : "#0f172a";
      const text =
        typeof feature.properties?.iconText === "string"
          ? (feature.properties.iconText as string)
          : "";
      const textColor =
        typeof feature.properties?.iconTextColor === "string"
          ? (feature.properties.iconTextColor as string)
          : getContrastTextColor(fill);
      const accent =
        typeof feature.properties?.iconAccent === "string"
          ? (feature.properties.iconAccent as string)
          : undefined;
      ensureMarkerIcon(
        map,
        markerIconCacheRef.current,
        iconId,
        fill,
        stroke,
        text,
        textColor,
        accent,
      );
    });
    const data = layerVisibility.tasks
      ? taskPointsGeoJSON
      : createEmptyCollection();
    source.setData(data);
  }, [layerVisibility.tasks, mapReady, taskPointsGeoJSON]);

  const legendItems = React.useMemo(() => {
    const base = TASK_STATUSES.map((status) => ({
      key: status,
      label: status,
      color: TASK_STATUS_COLORS[status] ?? "#2563eb",
      count: taskStatus[status] ?? 0,
    }));
    const extraStatuses = Object.keys(taskStatus).filter(
      (status) => !TASK_STATUSES.includes(status),
    );
    if (extraStatuses.length) {
      extraStatuses.forEach((status) => {
        base.push({
          key: status,
          label: status,
          color: TASK_STATUS_COLORS[status] ?? "#2563eb",
          count: taskStatus[status] ?? 0,
        });
      });
    }
    return base;
  }, [taskStatus]);

  const displayedTasks = React.useMemo(() => {
    if (!selectedTaskIdsSet.size) {
      return categoryFilteredTasks;
    }
    return categoryFilteredTasks.filter((task) => selectedTaskIdsSet.has(task._id));
  }, [categoryFilteredTasks, selectedTaskIdsSet]);

  const displayedSignature = React.useMemo(
    () =>
      JSON.stringify(
        displayedTasks.map((task) => [task._id, task.status, task.updatedAt ?? null]),
      ),
    [displayedTasks],
  );

  const lastSyncedSignatureRef = React.useRef<string>("");

  React.useEffect(() => {
    if (!clusterSelection) return;
    const ids = new Set(clusterSelection.ids);
    const stillPresent = categoryFilteredTasks.some((task) => ids.has(task._id));
    if (!stillPresent) {
      setClusterSelection(null);
    }
  }, [categoryFilteredTasks, clusterSelection]);

  const stopRouteAnimation = React.useCallback(() => {
    const controller = routeAnimationRef.current;
    if (controller.frameId !== null) {
      cancelAnimationFrame(controller.frameId);
      controller.frameId = null;
    }
    controller.lastTimestamp = null;
  }, []);

  const runRouteAnimation = React.useCallback(() => {
    stopRouteAnimation();
    if (!mapReady) {
      return;
    }
    const controller = routeAnimationRef.current;
    if (!controller.routes.length) {
      return;
    }
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const source = map.getSource(TASK_ANIMATION_SOURCE_ID) as
      | GeoJSONSource
      | undefined;
    if (!source) {
      return;
    }
    const initialFeatures = controller.routes.map((route) => {
      const { position, bearing } = getAnimationPoint(route, route.progress);
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: position },
        properties: {
          color: route.color,
          taskId: route.taskId,
          title: route.title,
          bearing,
          icon: ANIMATION_SYMBOL,
        },
      } satisfies GeoJSON.Feature<GeoJSON.Point>;
    });
    source.setData({
      type: "FeatureCollection",
      features: initialFeatures,
    });
    const step = (timestamp: number) => {
      const controllerState = routeAnimationRef.current;
      const mapInstance = mapRef.current;
      if (!mapInstance) {
        stopRouteAnimation();
        return;
      }
      const animationSource = mapInstance.getSource(
        TASK_ANIMATION_SOURCE_ID,
      ) as GeoJSONSource | undefined;
      if (!animationSource) {
        stopRouteAnimation();
        return;
      }
      const lastTimestamp = controllerState.lastTimestamp;
      controllerState.lastTimestamp = timestamp;
      const delta = lastTimestamp != null ? (timestamp - lastTimestamp) / 1000 : 0;
      const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
      controllerState.routes.forEach((route) => {
        if (route.total <= 0) {
          return;
        }
        route.progress =
          (route.progress + delta * ROUTE_SPEED_KM_PER_SEC) % route.total;
        const { position, bearing } = getAnimationPoint(route, route.progress);
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: position },
          properties: {
            color: route.color,
            taskId: route.taskId,
            title: route.title,
            bearing,
            icon: ANIMATION_SYMBOL,
          },
        });
      });
      animationSource.setData({
        type: "FeatureCollection",
        features,
      });
      controllerState.frameId = requestAnimationFrame(step);
    };
    controller.frameId = requestAnimationFrame(step);
  }, [mapReady, stopRouteAnimation]);

  React.useEffect(() => {
    if (lastSyncedSignatureRef.current === displayedSignature) {
      return;
    }
    lastSyncedSignatureRef.current = displayedSignature;
    setSorted(displayedTasks);
    const userId = Number((user as any)?.telegram_id) || undefined;
    controller.setIndex("logistics:all", displayedTasks, {
      kind: "task",
      mine: false,
      userId,
      pageSize: displayedTasks.length,
      total: displayedTasks.length,
      sort: "desc",
    });
  }, [controller, displayedSignature, displayedTasks, user]);

  const clonePlan = React.useCallback(
    (value: RoutePlan | null) =>
      value ? (JSON.parse(JSON.stringify(value)) as RoutePlan) : null,
    [],
  );

  const applyPlan = React.useCallback(
    (next: RoutePlan | null) => {
      setPlan(next);
      setPlanDraft(clonePlan(next));
      const newLinks = next
        ? next.routes
            .map((route) => route.routeLink)
            .filter((link): link is string => Boolean(link))
        : [];
      setLinks(newLinks);
    },
    [clonePlan],
  );

  const loadPlan = React.useCallback(async () => {
    setPlanLoading(true);
    setPlanMessage('');
    setPlanMessageTone('neutral');
    try {
      const drafts = await listRoutePlans('draft', 1, 1);
      if (drafts.items.length > 0) {
        applyPlan(drafts.items[0]);
        return;
      }
      const latest = await listRoutePlans(undefined, 1, 1);
      if (latest.items.length > 0) {
        applyPlan(latest.items[0]);
        return;
      }
      applyPlan(null);
      setPlanMessage(tRef.current('logistics.planEmpty'));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tRef.current('logistics.planLoadError');
      setPlanMessage(message);
      setPlanMessageTone('error');
    } finally {
      setPlanLoading(false);
    }
  }, [applyPlan]);

  const buildUpdatePayload = React.useCallback(
    (source: RoutePlan): RoutePlanUpdatePayload => ({
      title: source.title,
      notes: source.notes ?? null,
      routes: source.routes.map((route) => ({
        id: route.id,
        order: route.order,
        vehicleId: route.vehicleId ?? null,
        vehicleName: route.vehicleName ?? null,
        driverId: route.driverId ?? null,
        driverName: route.driverName ?? null,
        notes: route.notes ?? null,
        tasks: route.tasks.map((task) => task.taskId),
      })),
    }),
    [],
  );

  const updateRouteDraft = React.useCallback(
    (
      routeIndex: number,
      updater: (route: RoutePlan['routes'][number]) => RoutePlan['routes'][number],
    ) => {
      setPlanDraft((current) => {
        if (!current) return current;
        const routes = current.routes.map((route, idx) =>
          idx === routeIndex ? updater(route) : route,
        );
        return { ...current, routes };
      });
    },
    [],
  );

  const handlePlanTitleChange = React.useCallback((value: string) => {
    setPlanDraft((current) => (current ? { ...current, title: value } : current));
  }, []);

  const handlePlanNotesChange = React.useCallback((value: string) => {
    setPlanDraft((current) => (current ? { ...current, notes: value } : current));
  }, []);

  const handleDriverNameChange = React.useCallback(
    (routeIndex: number, value: string) => {
      updateRouteDraft(routeIndex, (route) => ({ ...route, driverName: value }));
    },
    [updateRouteDraft],
  );

  const handleVehicleNameChange = React.useCallback(
    (routeIndex: number, value: string) => {
      updateRouteDraft(routeIndex, (route) => ({ ...route, vehicleName: value }));
    },
    [updateRouteDraft],
  );

  const handleRouteNotesChange = React.useCallback(
    (routeIndex: number, value: string) => {
      updateRouteDraft(routeIndex, (route) => ({ ...route, notes: value || null }));
    },
    [updateRouteDraft],
  );

  const handleMoveTask = React.useCallback(
    (routeIndex: number, taskIndex: number, direction: number) => {
      setPlanDraft((current) => {
        if (!current) return current;
        const routes = current.routes.map((route, idx) => {
          if (idx !== routeIndex) return route;
          const tasks = [...route.tasks];
          const targetIndex = taskIndex + direction;
          if (targetIndex < 0 || targetIndex >= tasks.length) {
            return route;
          }
          const [task] = tasks.splice(taskIndex, 1);
          tasks.splice(targetIndex, 0, task);
          return {
            ...route,
            tasks: tasks.map((item, order) => ({ ...item, order })),
          };
        });
        return { ...current, routes };
      });
    },
    [],
  );

  const handleStartDrawing = React.useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;
    draw.changeMode("draw_polygon");
  }, []);

  const handleToggleZone = React.useCallback((zoneId: string, checked: boolean) => {
    setActiveGeoZoneIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(zoneId);
      } else {
        next.delete(zoneId);
      }
      return Array.from(next);
    });
  }, []);

  const handleRouteStatusVisibilityChange = React.useCallback(
    (status: RouteStatusFilterKey, visible: boolean) => {
      setHiddenRouteStatuses((prev) => {
        const next = new Set(prev);
        if (visible) {
          next.delete(status);
        } else {
          next.add(status);
        }
        return Array.from(next);
      });
    },
    [],
  );

  const handleTransportVisibilityChange = React.useCallback(
    (key: string, visible: boolean) => {
      setHiddenTransportTypes((prev) => {
        const next = new Set(prev);
        if (visible) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return Array.from(next);
      });
    },
    [],
  );

  const handleTaskTypeVisibilityChange = React.useCallback(
    (key: string, visible: boolean) => {
      setHiddenTaskTypes((prev) => {
        const next = new Set(prev);
        if (visible) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return Array.from(next);
      });
    },
    [],
  );

  const handleClearClusterSelection = React.useCallback(() => {
    setClusterSelection(null);
  }, []);

  const handleRemoveZone = React.useCallback((zone: GeoZone) => {
    const removeFromState = () => {
      setGeoZones((prev) => prev.filter((item) => item.id !== zone.id));
      setActiveGeoZoneIds((prev) => prev.filter((id) => id !== zone.id));
    };

    const draw = drawRef.current;
    if (!draw) {
      removeFromState();
      return;
    }

    const hadFeature = Boolean(draw.get(zone.drawId));
    const deleted = draw.delete(zone.drawId);

    if (!hadFeature) {
      removeFromState();
      return;
    }

    if (Array.isArray(deleted) ? deleted.length === 0 : !deleted) {
      removeFromState();
    }
  }, []);

  const handleSavePlan = React.useCallback(async () => {
    if (!planDraft) return;
    setPlanLoading(true);
    try {
      const payload = buildUpdatePayload(planDraft);
      const updated = await updateRoutePlan(planDraft.id, payload);
      applyPlan(updated);
      setPlanMessage(tRef.current('logistics.planSaved'));
      setPlanMessageTone('success');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tRef.current('logistics.planSaveError');
      setPlanMessage(message);
      setPlanMessageTone('error');
    } finally {
      setPlanLoading(false);
    }
  }, [planDraft, buildUpdatePayload, applyPlan]);

  const handleApprovePlan = React.useCallback(async () => {
    if (!planDraft) return;
    setPlanLoading(true);
    try {
      const updated = await changeRoutePlanStatus(planDraft.id, 'approved');
      applyPlan(updated);
      setPlanMessage(tRef.current('logistics.planPublished'));
      setPlanMessageTone('success');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tRef.current('logistics.planStatusError');
      setPlanMessage(message);
      setPlanMessageTone('error');
    } finally {
      setPlanLoading(false);
    }
  }, [planDraft, applyPlan]);

  const handleCompletePlan = React.useCallback(async () => {
    if (!planDraft) return;
    setPlanLoading(true);
    try {
      const updated = await changeRoutePlanStatus(planDraft.id, 'completed');
      applyPlan(updated);
      setPlanMessage(tRef.current('logistics.planCompleted'));
      setPlanMessageTone('success');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tRef.current('logistics.planStatusError');
      setPlanMessage(message);
      setPlanMessageTone('error');
    } finally {
      setPlanLoading(false);
    }
  }, [planDraft, applyPlan]);

  const handleReloadPlan = React.useCallback(async () => {
    setPlanMessage('');
    setPlanMessageTone('neutral');
    await loadPlan();
  }, [loadPlan]);

  const handleClearPlan = React.useCallback(() => {
    applyPlan(null);
    setPlanMessage(tRef.current('logistics.planEmpty'));
    setPlanMessageTone('neutral');
  }, [applyPlan]);

  React.useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  React.useEffect(() => {
    const translate = tRef.current;
    const title = translate("logistics.metaTitle");
    const description = translate("logistics.metaDescription");
    const image = "/hero/logistics.png";

    document.title = title;

    const ensureMeta = (
      attribute: "name" | "property",
      name: string,
      value: string,
    ) => {
      let element = document.querySelector<HTMLMetaElement>(
        `meta[${attribute}="${name}"]`,
      );
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      element.setAttribute("content", value);
    };

    ensureMeta("name", "description", description);
    ensureMeta("property", "og:title", title);
    ensureMeta("property", "og:description", description);
    ensureMeta("property", "og:image", image);
  }, [language]);

  const openTask = React.useCallback(
    (id: string) => {
      const params = new URLSearchParams(location.search);
      params.set("task", id);
      navigate({ search: params.toString() }, { replace: true });
    },
    [location, navigate],
  );

  const filterRouteTasks = React.useCallback((input: RouteTask[]) => {
    const hasPoint = (coords?: Coords | null) =>
      typeof coords?.lat === "number" &&
      Number.isFinite(coords.lat) &&
      typeof coords?.lng === "number" &&
      Number.isFinite(coords.lng);

    return input.filter((task) => {
      const details = (task as Record<string, unknown>)
        .logistics_details as LogisticsDetails | undefined;
      const transportTypeRaw =
        typeof details?.transport_type === "string"
          ? details.transport_type.trim()
          : "";
      const normalizedTransportType = transportTypeRaw.toLowerCase();
      const hasTransportType =
        Boolean(transportTypeRaw) && normalizedTransportType !== "без транспорта";

      if (!hasTransportType) {
        return false;
      }

      const hasCoordinates = hasPoint(task.startCoordinates) || hasPoint(task.finishCoordinates);
      const hasAddresses =
        (typeof details?.start_location === "string" &&
          details.start_location.trim().length > 0) ||
        (typeof details?.end_location === "string" &&
          details.end_location.trim().length > 0);

      return hasCoordinates || hasAddresses;
    });
  }, []);

  const load = React.useCallback(() => {
    const userId = Number((user as any)?.telegram_id) || undefined;
    fetchTasks({}, userId, true).then((data: any) => {
      const raw = Array.isArray(data)
        ? data
        : data.items || data.tasks || data.data || [];
      const mapped: Array<RouteTask | null> = raw.map((item: Record<string, unknown>) => {
        const task = item as RouteTask & { id?: string };
        const identifier = String(task._id ?? task.id ?? "").trim();
        if (!identifier) {
          return null;
        }
        return {
          ...task,
          id: identifier,
          _id: identifier,
        } satisfies RouteTask;
      });
      const list = mapped.filter(
        (task): task is RouteTask => Boolean(task),
      );
      const filtered = filterRouteTasks(list);
      setAllRouteTasks(filtered);
    });
  }, [controller, filterRouteTasks, user]);

  const loadFleetVehicles = React.useCallback(async () => {
    if (role !== "admin") return;
    setVehiclesLoading(true);
    setVehiclesHint("");
    setFleetError("");
    try {
      const data = await listFleetVehicles("", 1, 100);
      setAvailableVehicles(data.items);
      if (!data.items.length) {
        setVehiclesHint(tRef.current("logistics.noVehicles"));
        return;
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tRef.current("logistics.loadError");
      setVehiclesHint(message);
      setAvailableVehicles([]);
      setFleetError(message);
    } finally {
      setVehiclesLoading(false);
    }
  }, [role, tRef]);

  const refreshAll = React.useCallback(() => {
    load();
    if (role === "admin") {
      void loadFleetVehicles();
    }
  }, [load, loadFleetVehicles, role]);

  const refreshFleet = React.useCallback(() => {
    if (role === "admin") {
      void loadFleetVehicles();
    }
  }, [loadFleetVehicles, role]);

  React.useEffect(() => {
    const pending = {
      tasks: false,
      plan: false,
      fleet: false,
    };
    let isActive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const flush = () => {
      timer = null;
      if (!isActive) {
        pending.tasks = false;
        pending.plan = false;
        pending.fleet = false;
        return;
      }
      const shouldRefreshTasks = pending.tasks;
      const shouldRefreshPlan = pending.plan;
      const shouldRefreshFleet = pending.fleet;
      pending.tasks = false;
      pending.plan = false;
      pending.fleet = false;

      if (shouldRefreshTasks) {
        load();
      }
      if (shouldRefreshFleet) {
        refreshFleet();
      }
      if (shouldRefreshPlan) {
        void loadPlan();
      }
    };

    const schedule = () => {
      if (timer !== null) {
        return;
      }
      if (LOGISTICS_EVENT_DEBOUNCE_MS <= 0) {
        flush();
        return;
      }
      timer = setTimeout(flush, LOGISTICS_EVENT_DEBOUNCE_MS);
    };

    const unsubscribe = subscribeLogisticsEvents((event) => {
      switch (event.type) {
        case "logistics.init":
          pending.tasks = true;
          pending.plan = true;
          pending.fleet = true;
          break;
        case "tasks.changed":
          pending.tasks = true;
          pending.plan = true;
          break;
        case "route-plan.updated":
        case "route-plan.removed":
          pending.plan = true;
          break;
        default:
          return;
      }
      schedule();
    });

    return () => {
      isActive = false;
      clearTimer();
      unsubscribe();
    };
  }, [load, loadPlan, refreshFleet]);

  const calculate = React.useCallback(async () => {
    const ids = sorted.map((t) => t._id);
    if (!ids.length) {
      applyPlan(null);
      setPlanMessage(tRef.current('logistics.planEmpty'));
      setPlanMessageTone('neutral');
      return;
    }
    setPlanLoading(true);
    setPlanMessage('');
    setPlanMessageTone('neutral');
    try {
      const result = await optimizeRoute(ids, vehicles, method);
      if (!result) {
        applyPlan(null);
        setPlanMessage(tRef.current('logistics.planEmpty'));
        return;
      }
      applyPlan(result);
      setPlanMessage(tRef.current('logistics.planDraftCreated'));
      setPlanMessageTone('success');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tRef.current('logistics.planOptimizeError');
      setPlanMessage(message);
      setPlanMessageTone('error');
    } finally {
      setPlanLoading(false);
    }
  }, [applyPlan, method, sorted, vehicles]);

  const formatDistance = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return `${value.toFixed(1)} ${tRef.current('km')}`;
      }
      return tRef.current('logistics.planNoDistance');
    },
    [],
  );

  const formatAreaMetric = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '—';
      }
      if (value >= 1) {
        return `${new Intl.NumberFormat(language, {
          maximumFractionDigits: 2,
        }).format(value)} км²`;
      }
      const hectares = value * 100;
      if (hectares >= 1) {
        return `${new Intl.NumberFormat(language, {
          maximumFractionDigits: 1,
        }).format(hectares)} га`;
      }
      const squareMeters = value * 1_000_000;
      return `${new Intl.NumberFormat(language, {
        maximumFractionDigits: 0,
      }).format(squareMeters)} м²`;
    },
    [language],
  );

  const formatPerimeterMetric = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '—';
      }
      if (value >= 1) {
        return `${new Intl.NumberFormat(language, {
          maximumFractionDigits: 2,
        }).format(value)} км`;
      }
      const meters = value * 1000;
      return `${new Intl.NumberFormat(language, {
        maximumFractionDigits: 0,
      }).format(meters)} м`;
    },
    [language],
  );

  const formatBufferMetric = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '—';
      }
      return `${new Intl.NumberFormat(language, {
        maximumFractionDigits: 0,
      }).format(value)} м`;
    },
    [language],
  );

  const planMessageClass = React.useMemo(() => {
    if (planMessageTone === 'error') {
      return 'text-sm text-red-600';
    }
    if (planMessageTone === 'success') {
      return 'text-sm text-emerald-600';
    }
    return 'text-sm text-muted-foreground';
  }, [planMessageTone]);

  const planStatus: RoutePlanStatus = planDraft?.status ?? plan?.status ?? 'draft';
  const planStatusLabel = t(`logistics.planStatusValue.${planStatus}`);
  const isPlanEditable = planStatus !== 'completed';
  const planRoutes = planDraft?.routes ?? [];
  const totalStops = React.useMemo(() => {
    if (typeof planDraft?.metrics?.totalStops === 'number') {
      return planDraft.metrics.totalStops;
    }
    if (!planDraft) {
      return 0;
    }
    return planDraft.routes.reduce((acc, route) => acc + route.stops.length, 0);
  }, [planDraft]);
  const planTotalRoutes = planDraft?.metrics?.totalRoutes ?? planRoutes.length;
  const planTotalTasks = planDraft?.metrics?.totalTasks ?? planDraft?.tasks.length ?? 0;

  const reset = React.useCallback(() => {
    setOptimizedRoutesGeoJSON(createEmptyCollection<GeoJSON.LineString>());
    setLinks([]);
  }, []);

  React.useEffect(() => {
    load();
  }, [load, location.key]);

  React.useEffect(() => {
    setPage(0);
  }, [displayedSignature]);

  React.useEffect(() => {
    const translate = tRef.current;
    if (role !== "admin") {
      hasLoadedFleetRef.current = false;
      setAvailableVehicles([]);
      setFleetError(role === "manager" ? translate("logistics.adminOnly") : "");
      setVehiclesHint(role ? translate("logistics.noAccess") : "");
      return;
    }
    setVehiclesHint("");
    setFleetError("");
    if (!hasLoadedFleetRef.current) {
      hasLoadedFleetRef.current = true;
      void loadFleetVehicles();
    }
  }, [loadFleetVehicles, role]);

  React.useEffect(() => {
    const translate = tRef.current;
    if (role !== "admin") {
      return;
    }
    if (!availableVehicles.length && !fleetError && !vehiclesLoading) {
      setVehiclesHint(translate("logistics.noVehicles"));
    }
  }, [availableVehicles.length, fleetError, role, vehiclesLoading]);

  React.useEffect(() => {
    if (hasDialog) return;
    if (mapRef.current) return;
    const map = new maplibregl.Map({
      container: "logistics-map",
      style: MAP_STYLE_URL,
      center: MAP_CENTER_LNG_LAT,
      zoom: MAP_DEFAULT_ZOOM,
      minZoom: 5,
      maxZoom: 12,
      maxBounds: UKRAINE_BOUNDS,
    });
    mapRef.current = map;
    if (typeof map.dragRotate?.disable === "function") {
      map.dragRotate.disable();
    }
    if (typeof map.touchZoomRotate?.disableRotation === "function") {
      map.touchZoomRotate.disableRotation();
    }
    const navigation = new maplibregl.NavigationControl({ showCompass: false });
    map.addControl(navigation, "top-right");
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: "simple_select",
    });
    drawRef.current = draw;
    map.addControl(draw, "top-left");
    map.on("load", () => {
      map.addSource(GEO_SOURCE_ID, {
        type: "geojson",
        data: createEmptyCollection(),
      });
      map.addLayer({
        id: GEO_FILL_LAYER_ID,
        type: "fill",
        source: GEO_SOURCE_ID,
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["get", "active"], false],
            "rgba(37, 99, 235, 0.35)",
            "rgba(148, 163, 184, 0.2)",
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["get", "active"], false],
            0.4,
            0.2,
          ],
        },
      });
      map.addLayer({
        id: GEO_OUTLINE_LAYER_ID,
        type: "line",
        source: GEO_SOURCE_ID,
        paint: {
          "line-color": [
            "case",
            ["boolean", ["get", "active"], false],
            "#2563eb",
            "#94a3b8",
          ],
          "line-width": [
            "case",
            ["boolean", ["get", "active"], false],
            2.5,
            1.5,
          ],
        },
      });
      map.addSource(OPT_SOURCE_ID, {
        type: "geojson",
        data: createEmptyCollection(),
      });
      const optimizedLayer: LineLayerSpecification = {
        id: OPT_LAYER_ID,
        type: "line",
        source: OPT_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 4,
          "line-dasharray": [1.5, 1.5],
          "line-opacity": 0.8,
        },
      };
      map.addLayer(optimizedLayer);
      map.addSource(TASK_SOURCE_ID, {
        type: "geojson",
        data: createEmptyCollection(),
      });
      const taskLineLayer: LineLayerSpecification = {
        id: TASK_LAYER_ID,
        type: "line",
        source: TASK_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 3,
          "line-opacity": 0.85,
        },
      };
      map.addLayer(taskLineLayer);
      map.addSource(TASK_CLUSTER_SOURCE_ID, {
        type: "geojson",
        data: createEmptyCollection(),
        cluster: true,
        clusterRadius: 60,
        clusterMaxZoom: 14,
        clusterProperties: {
          draft: CLUSTER_STATUS_PROPERTIES.draft,
          approved: CLUSTER_STATUS_PROPERTIES.approved,
          completed: CLUSTER_STATUS_PROPERTIES.completed,
          unassigned: CLUSTER_STATUS_PROPERTIES.unassigned,
        },
      });
      const clusterLayer: CircleLayerSpecification = {
        id: TASK_CLUSTER_LAYER_ID,
        type: "circle",
        source: TASK_CLUSTER_SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "case",
            [
              "all",
              [">=", ["get", "completed"], ["get", "approved"]],
              [">=", ["get", "completed"], ["get", "draft"]],
              [">=", ["get", "completed"], ["get", "unassigned"]],
            ],
            ROUTE_STATUS_COLORS.completed,
            [
              "all",
              [">=", ["get", "approved"], ["get", "draft"]],
              [">=", ["get", "approved"], ["get", "unassigned"]],
            ],
            ROUTE_STATUS_COLORS.approved,
            [">=", ["get", "draft"], ["get", "unassigned"]],
            ROUTE_STATUS_COLORS.draft,
            ROUTE_STATUS_COLORS.unassigned,
          ],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            16,
            12,
            22,
            14,
            30,
          ],
          "circle-opacity": 0.82,
          "circle-stroke-width": 1.6,
          "circle-stroke-color": "#f8fafc",
        },
      };
      map.addLayer(clusterLayer);
      const clusterCountLayer: SymbolLayerSpecification = {
        id: TASK_CLUSTER_COUNT_LAYER_ID,
        type: "symbol",
        source: TASK_CLUSTER_SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#0f172a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.2,
        },
      };
      map.addLayer(clusterCountLayer);
      const pointsLayer: SymbolLayerSpecification = {
        id: TASK_POINTS_LAYER_ID,
        type: "symbol",
        source: TASK_CLUSTER_SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": ["get", "iconId"],
          "icon-size": [
            "case",
            ["boolean", ["get", "selected"], false],
            0.8,
            0.65,
          ],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "text-field": ["coalesce", ["get", "label"], ""],
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 10,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "text-optional": true,
        },
        paint: {
          "icon-opacity": 0.95,
          "text-color": "#0f172a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 0.9,
        },
      };
      map.addLayer(pointsLayer);
      map.addSource(TASK_ANIMATION_SOURCE_ID, {
        type: "geojson",
        data: createEmptyCollection(),
      });
      const animationLayer: SymbolLayerSpecification = {
        id: TASK_ANIMATION_LAYER_ID,
        type: "symbol",
        source: TASK_ANIMATION_SOURCE_ID,
        layout: {
          "text-field": ["get", "icon"],
          "text-size": 20,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-rotate": ["get", "bearing"],
        },
        paint: {
          "text-color": ["get", "color"],
          "text-halo-color": "rgba(17, 24, 39, 0.55)",
          "text-halo-width": 1.2,
        },
      };
      map.addLayer(animationLayer);
      setMapReady(true);
    });
    return () => {
      setMapReady(false);
      setIsDrawing(false);
      drawRef.current = null;
      stopRouteAnimation();
      map.remove();
      mapRef.current = null;
    };
  }, [hasDialog, stopRouteAnimation]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const enableRotation = () => {
      if (typeof map.dragRotate?.enable === "function") {
        map.dragRotate.enable();
      }
      if (typeof map.touchZoomRotate?.enableRotation === "function") {
        map.touchZoomRotate.enableRotation();
      }
    };
    const disableRotation = () => {
      if (typeof map.dragRotate?.disable === "function") {
        map.dragRotate.disable();
      }
      if (typeof map.touchZoomRotate?.disableRotation === "function") {
        map.touchZoomRotate.disableRotation();
      }
    };
    if (mapViewMode === "perspective") {
      enableRotation();
      if (typeof map.easeTo === "function") {
        map.easeTo({ pitch: 55, bearing: 28, duration: 600 });
      } else {
        map.setPitch(55);
        map.setBearing(28);
      }
    } else {
      if (typeof map.easeTo === "function") {
        map.easeTo({ pitch: 0, bearing: 0, duration: 400 });
      } else {
        map.setPitch(0);
        map.setBearing(0);
      }
      disableRotation();
    }
  }, [mapReady, mapViewMode]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    const draw = drawRef.current;
    if (!map || !draw) return;
    const createdZones: GeoZone[] = [];
    const updatedZones = new Map<string, GeoZoneFeature>();

    const handleCreate = (event: { features?: GeoJSON.Feature[] }) => {
      createdZones.length = 0;
      setGeoZones((prev) => {
        const base = [...prev];
        const baseLength = prev.length;
        const now = new Date().toISOString();
        for (const feature of event.features ?? []) {
          if (!feature || !isPolygonGeometry(feature.geometry)) continue;
          const drawId =
            typeof feature.id === "string"
              ? feature.id
              : feature.id != null
                ? String(feature.id)
                : `draw-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const zoneId =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `zone-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const name = tRef.current("logistics.geozoneDefaultName", {
            index: baseLength + createdZones.length + 1,
          });
          const zone = buildGeoZone({
            id: zoneId,
            drawId,
            name,
            createdAt: now,
            geometry: feature.geometry,
            properties: feature.properties ?? {},
            active: true,
          });
          createdZones.push(zone);
          base.push(zone);
        }
        return base;
      });
      if (createdZones.length) {
        setActiveGeoZoneIds((prev) => {
          const next = new Set(prev);
          createdZones.forEach((zone) => next.add(zone.id));
          return Array.from(next);
        });
      }
    };

    const handleDelete = (event: { features?: GeoJSON.Feature[] }) => {
      const removedDrawIds = new Set<string>();
      for (const feature of event.features ?? []) {
        if (!feature) continue;
        const drawId =
          typeof feature.id === "string"
            ? feature.id
            : feature.id != null
              ? String(feature.id)
              : "";
        if (drawId) {
          removedDrawIds.add(drawId);
        }
      }
      if (!removedDrawIds.size) {
        return;
      }
      const removedZoneIds: string[] = [];
      setGeoZones((prev) => {
        const next = prev.filter((zone) => {
          const shouldRemove = removedDrawIds.has(zone.drawId);
          if (shouldRemove) {
            removedZoneIds.push(zone.id);
          }
          return !shouldRemove;
        });
        return next;
      });
      if (removedZoneIds.length) {
        setActiveGeoZoneIds((prev) => prev.filter((id) => !removedZoneIds.includes(id)));
      }
    };

    const handleUpdate = (event: { features?: GeoJSON.Feature[] }) => {
      updatedZones.clear();
      for (const feature of event.features ?? []) {
        if (!feature || !isPolygonGeometry(feature.geometry)) continue;
        const drawId =
          typeof feature.id === "string"
            ? feature.id
            : feature.id != null
              ? String(feature.id)
              : "";
        if (!drawId) continue;
        updatedZones.set(drawId, {
          type: "Feature",
          geometry: feature.geometry,
          properties: { ...(feature.properties ?? {}) },
        });
      }
      if (!updatedZones.size) return;
      setGeoZones((prev) =>
        prev.map((zone) => {
          const updated = updatedZones.get(zone.drawId);
          if (!updated) {
            return zone;
          }
          if (!isPolygonGeometry(updated.geometry)) {
            return zone;
          }
          return buildGeoZone({
            id: zone.id,
            drawId: zone.drawId,
            name: zone.name,
            createdAt: zone.createdAt,
            geometry: updated.geometry,
            properties: updated.properties ?? zone.feature.properties ?? {},
            active: activeGeoZoneIds.includes(zone.id),
            bufferMeters: zone.metrics.bufferMeters,
          });
        }),
      );
    };

    const handleModeChange = (event: { mode: string }) => {
      setIsDrawing(event.mode === "draw_polygon");
    };

    map.on("draw.create", handleCreate as any);
    map.on("draw.delete", handleDelete as any);
    map.on("draw.update", handleUpdate as any);
    map.on("draw.modechange", handleModeChange as any);

    return () => {
      map.off("draw.create", handleCreate as any);
      map.off("draw.delete", handleDelete as any);
      map.off("draw.update", handleUpdate as any);
      map.off("draw.modechange", handleModeChange as any);
    };
  }, [activeGeoZoneIds, mapReady]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(GEO_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    const features = geoZones.map((zone) => ({
      ...zone.feature,
      id: zone.drawId,
      properties: {
        ...(zone.feature.properties ?? {}),
        zoneId: zone.id,
        name: zone.name,
        active: activeGeoZoneIds.includes(zone.id),
      },
    }));
    source.setData({
      type: "FeatureCollection",
      features,
    });
  }, [activeGeoZoneIds, geoZones, mapReady]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const routesSource = map.getSource(TASK_SOURCE_ID) as
      | GeoJSONSource
      | undefined;
    const animationSource = map.getSource(TASK_ANIMATION_SOURCE_ID) as
      | GeoJSONSource
      | undefined;
    if (!routesSource || !animationSource) {
      return;
    }
    if (!layerVisibility.tasks || !sorted.length) {
      routesSource.setData(createEmptyCollection());
      animationSource.setData(createEmptyCollection());
      routeAnimationRef.current.routes = [];
      stopRouteAnimation();
      return;
    }
    let cancelled = false;
    (async () => {
      const lineFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
      const animationRoutes: AnimatedRoute[] = [];
      for (const task of sorted) {
        if (cancelled) break;
        const start = toPosition(task.startCoordinates);
        const finish = toPosition(task.finishCoordinates);
        if (!start || !finish) continue;
        const geometry = await fetchRouteGeometry(
          task.startCoordinates,
          task.finishCoordinates,
        );
        if (!geometry || cancelled) continue;
        const statusKey =
          typeof task.status === "string" ? task.status.trim() : "";
        const routeColor = TASK_STATUS_COLORS[statusKey] ?? "#2563eb";
        const coordinates = geometry as GeoJSON.Position[];
        lineFeatures.push({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates,
          },
          properties: {
            color: routeColor,
            taskId: task._id,
            title: task.title ?? task._id,
          },
        });
        const animatedRoute = createAnimatedRoute(
          coordinates,
          routeColor,
          task._id,
          task.title ?? task._id,
        );
        if (animatedRoute) {
          animationRoutes.push(animatedRoute);
        }
      }
      if (cancelled) return;
      routesSource.setData({
        type: "FeatureCollection",
        features: lineFeatures,
      });
      routeAnimationRef.current.routes = animationRoutes;
      routeAnimationRef.current.lastTimestamp = null;
      if (!animationRoutes.length) {
        animationSource.setData(createEmptyCollection());
        stopRouteAnimation();
      } else {
        runRouteAnimation();
      }
    })();
    return () => {
      cancelled = true;
      stopRouteAnimation();
    };
  }, [
    layerVisibility.tasks,
    mapReady,
    runRouteAnimation,
    sorted,
    stopRouteAnimation,
  ]);

  React.useEffect(() => {
    if (!layerVisibility.optimized || !planDraft) {
      setOptimizedRoutesGeoJSON(createEmptyCollection<GeoJSON.LineString>());
      return;
    }
    const colors = ["#ef4444", "#22c55e", "#f97316"];
    const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    planDraft.routes.forEach((route, idx) => {
      const coordinates: GeoJSON.Position[] = [];
      route.tasks.forEach((task) => {
        const start = toPosition(task.start);
        const finish = toPosition(task.finish);
        if (start) {
          coordinates.push(start);
        }
        if (finish) {
          coordinates.push(finish);
        }
      });
      if (coordinates.length < 2) {
        return;
      }
      features.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates,
        },
        properties: {
          color: colors[idx % colors.length],
          routeId: route.id,
        },
      });
    });
    setOptimizedRoutesGeoJSON({
      type: "FeatureCollection",
      features,
    });
  }, [layerVisibility.optimized, planDraft]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(OPT_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(optimizedRoutesGeoJSON);
  }, [mapReady, optimizedRoutesGeoJSON]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const setVisibility = (layerId: string, visible: boolean) => {
      if (!map.getLayer(layerId)) return;
      map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
    };
    setVisibility(TASK_LAYER_ID, layerVisibility.tasks);
    setVisibility(TASK_CLUSTER_LAYER_ID, layerVisibility.tasks);
    setVisibility(TASK_CLUSTER_COUNT_LAYER_ID, layerVisibility.tasks);
    setVisibility(TASK_POINTS_LAYER_ID, layerVisibility.tasks);
    setVisibility(TASK_ANIMATION_LAYER_ID, layerVisibility.tasks);
    setVisibility(OPT_LAYER_ID, layerVisibility.optimized);
  }, [layerVisibility.optimized, layerVisibility.tasks, mapReady]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(TASK_CLUSTER_SOURCE_ID) as
      | GeoJSONSource
      | undefined;
    if (!source) return;
    const handlePointClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const entity = feature.properties?.entity;
      if (entity === "vehicle") {
        return;
      }
      const taskId = feature.properties?.taskId;
      if (typeof taskId === "string" && taskId) {
        openTask(taskId);
      }
    };
    const handleClusterClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const clusterId = feature.properties?.cluster_id;
      if (typeof clusterId !== "number") {
        return;
      }
      const coordinates =
        feature.geometry && feature.geometry.type === "Point"
          ? (feature.geometry.coordinates as GeoJSON.Position)
          : null;
      (source as any).getClusterExpansionZoom(
        clusterId,
        (error: Error | null, zoom: number) => {
          if (!error && typeof zoom === "number" && coordinates) {
            map.easeTo({ center: coordinates, zoom, duration: 600 });
          }
        },
      );
      const total =
        typeof feature.properties?.point_count === "number"
          ? (feature.properties.point_count as number)
          : 0;
      const limit = Math.min(Math.max(total, 1), 50);
      const collected = new Set<string>();
      const gatherLeaves = (offset: number) => {
        (source as any).getClusterLeaves(
          clusterId,
          limit,
          offset,
          (
            err: Error | null,
            features: GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>[],
          ) => {
            if (err || !features) {
              return;
            }
            features.forEach((item) => {
              if (item.properties?.entity === "task") {
                const taskId = item.properties?.taskId;
                if (typeof taskId === "string" && taskId) {
                  collected.add(taskId);
                }
              }
            });
            if (features.length === limit && offset + features.length < total) {
              gatherLeaves(offset + features.length);
            } else {
              const ids = Array.from(collected);
              setClusterSelection(
                ids.length
                  ? { ids, center: coordinates ?? null }
                  : null,
              );
            }
          },
        );
      };
      gatherLeaves(0);
    };
    const setCursor = (cursor: string) => {
      const canvas = map.getCanvas();
      canvas.style.cursor = cursor;
    };
    const handleEnter = () => setCursor("pointer");
    const handleLeave = () => setCursor("");
    map.on("click", TASK_POINTS_LAYER_ID, handlePointClick as any);
    map.on("mouseenter", TASK_POINTS_LAYER_ID, handleEnter as any);
    map.on("mouseleave", TASK_POINTS_LAYER_ID, handleLeave as any);
    map.on("click", TASK_CLUSTER_LAYER_ID, handleClusterClick as any);
    map.on("mouseenter", TASK_CLUSTER_LAYER_ID, handleEnter as any);
    map.on("mouseleave", TASK_CLUSTER_LAYER_ID, handleLeave as any);
    return () => {
      map.off("click", TASK_POINTS_LAYER_ID, handlePointClick as any);
      map.off("mouseenter", TASK_POINTS_LAYER_ID, handleEnter as any);
      map.off("mouseleave", TASK_POINTS_LAYER_ID, handleLeave as any);
      map.off("click", TASK_CLUSTER_LAYER_ID, handleClusterClick as any);
      map.off("mouseenter", TASK_CLUSTER_LAYER_ID, handleEnter as any);
      map.off("mouseleave", TASK_CLUSTER_LAYER_ID, handleLeave as any);
    };
  }, [mapReady, openTask]);

  React.useEffect(() => {
    if (hasDialog) return;
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    if (typeof map.resize === "function") {
      map.resize();
    }
  }, [hasDialog, mapReady]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <h2 className="text-xl font-semibold">{t("logistics.title")}</h2>
      <section className="space-y-3 rounded border bg-white/80 p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">
              {t("logistics.planSectionTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("logistics.planSummary")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {t("logistics.planStatus")}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
              {planStatusLabel}
            </span>
            {planLoading ? (
              <span className="text-xs text-muted-foreground">
                {t("loading")}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReloadPlan}
            disabled={planLoading}
          >
            {planLoading
              ? t("loading")
              : t("logistics.planReload")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClearPlan}
            disabled={planLoading}
          >
            {t("logistics.planClear")}
          </Button>
          <Button
            type="button"
            onClick={handleSavePlan}
            disabled={!planDraft || !isPlanEditable || planLoading}
          >
            {t("save")}
          </Button>
          {planDraft?.status === "draft" ? (
            <Button
              type="button"
              variant="success"
              onClick={handleApprovePlan}
              disabled={planLoading}
            >
              {t("logistics.planApprove")}
            </Button>
          ) : null}
          {planDraft?.status === "approved" ? (
            <Button
              type="button"
              variant="success"
              onClick={handleCompletePlan}
              disabled={planLoading}
            >
              {t("logistics.planComplete")}
            </Button>
          ) : null}
        </div>
        {planDraft ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">
                  {t("logistics.planTitleLabel")}
                </span>
                <Input
                  value={planDraft.title}
                  onChange={(event) =>
                    handlePlanTitleChange(event.target.value)
                  }
                  disabled={!isPlanEditable || planLoading}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">
                  {t("logistics.planNotesLabel")}
                </span>
                <textarea
                  value={planDraft.notes ?? ""}
                  onChange={(event) =>
                    handlePlanNotesChange(event.target.value)
                  }
                  className="min-h-[96px] rounded border px-3 py-2 text-sm"
                  disabled={!isPlanEditable || planLoading}
                />
              </label>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold uppercase text-muted-foreground">
                {t("logistics.planSummary")}
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="text-xs uppercase text-muted-foreground">
                    {t("logistics.planTotalDistance")}
                  </div>
                  <div className="font-semibold">
                    {formatDistance(planDraft.metrics?.totalDistanceKm ?? null)}
                  </div>
                </div>
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="text-xs uppercase text-muted-foreground">
                    {t("logistics.planTotalRoutes")}
                  </div>
                  <div className="font-semibold">{planTotalRoutes}</div>
                </div>
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="text-xs uppercase text-muted-foreground">
                    {t("logistics.planTotalTasks")}
                  </div>
                  <div className="font-semibold">{planTotalTasks}</div>
                </div>
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="text-xs uppercase text-muted-foreground">
                    {t("logistics.planTotalStops")}
                  </div>
                  <div className="font-semibold">{totalStops}</div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {planRoutes.map((route, routeIndex) => {
                const displayIndex =
                  typeof route.order === "number" && Number.isFinite(route.order)
                    ? route.order + 1
                    : routeIndex + 1;
                const routeStops = route.metrics?.stops ?? route.stops.length;
                return (
                  <div
                    key={route.id || `${routeIndex}`}
                    className="space-y-3 rounded border bg-white/70 px-3 py-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-base font-semibold">
                          {t("logistics.planRouteTitle", { index: displayIndex })}
                        </h4>
                        <div className="text-xs text-muted-foreground">
                          {t("logistics.planRouteSummary", {
                            tasks: route.tasks.length,
                            stops: routeStops,
                          })}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("logistics.planRouteDistance", {
                          distance: formatDistance(route.metrics?.distanceKm ?? null),
                        })}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium">
                          {t("logistics.planDriver")}
                        </span>
                        <Input
                          value={route.driverName ?? ""}
                          onChange={(event) =>
                            handleDriverNameChange(routeIndex, event.target.value)
                          }
                          disabled={!isPlanEditable || planLoading}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium">
                          {t("logistics.planVehicle")}
                        </span>
                        <Input
                          value={route.vehicleName ?? ""}
                          onChange={(event) =>
                            handleVehicleNameChange(routeIndex, event.target.value)
                          }
                          disabled={!isPlanEditable || planLoading}
                        />
                      </label>
                      <label className="md:col-span-2 flex flex-col gap-1 text-sm">
                        <span className="font-medium">
                          {t("logistics.planRouteNotes")}
                        </span>
                        <textarea
                          value={route.notes ?? ""}
                          onChange={(event) =>
                            handleRouteNotesChange(routeIndex, event.target.value)
                          }
                          className="min-h-[80px] rounded border px-3 py-2 text-sm"
                          disabled={!isPlanEditable || planLoading}
                        />
                      </label>
                      <div className="md:col-span-2 space-y-2">
                        <ul className="space-y-2">
                          {route.tasks.length ? (
                            route.tasks.map((task, taskIndex) => (
                              <li
                                key={task.taskId || `${routeIndex}-${taskIndex}`}
                                className="space-y-2 rounded border bg-white px-3 py-2 text-sm shadow-sm"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <div className="font-medium">
                                      {task.title ?? task.taskId}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {t("task")}: {task.taskId}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="xs"
                                      onClick={() =>
                                        handleMoveTask(routeIndex, taskIndex, -1)
                                      }
                                      disabled={
                                        !isPlanEditable ||
                                        planLoading ||
                                        taskIndex === 0
                                      }
                                    >
                                      {t("logistics.planTaskUp")}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="xs"
                                      onClick={() =>
                                        handleMoveTask(routeIndex, taskIndex, 1)
                                      }
                                      disabled={
                                        !isPlanEditable ||
                                        planLoading ||
                                        taskIndex === route.tasks.length - 1
                                      }
                                    >
                                      {t("logistics.planTaskDown")}
                                    </Button>
                                  </div>
                                </div>
                                <div className="space-y-1 text-xs text-muted-foreground">
                                  {task.startAddress ? (
                                    <div>
                                      <span className="font-medium">
                                        {t("startPoint")}:
                                      </span>{" "}
                                      {task.startAddress}
                                    </div>
                                  ) : null}
                                  {task.finishAddress ? (
                                    <div>
                                      <span className="font-medium">
                                        {t("endPoint")}:
                                      </span>{" "}
                                      {task.finishAddress}
                                    </div>
                                  ) : null}
                                  {typeof task.distanceKm === "number" &&
                                  Number.isFinite(task.distanceKm) ? (
                                    <div>
                                      {t("logistics.planRouteDistance", {
                                        distance: formatDistance(task.distanceKm ?? null),
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              </li>
                            ))
                          ) : (
                            <li className="rounded border border-dashed bg-white/60 px-3 py-2 text-sm text-muted-foreground">
                              {t("logistics.planRouteEmpty")}
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {planMessage ? (
              <div className={planMessageClass}>{planMessage}</div>
            ) : null}
          </div>
        ) : (
          <div className={planMessageClass}>
            {planLoading
              ? t("loading")
              : planMessage || t("logistics.planEmpty")}
          </div>
        )}
      </section>
      {role === "admin" ? (
        <section className="space-y-3 rounded border bg-white/80 p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <h3 className="font-semibold">{t("logistics.transport")}</h3>
            <Button
              type="button"
              size="sm"
              onClick={refreshFleet}
              disabled={vehiclesLoading}
            >
              {vehiclesLoading
                ? t("loading")
                : t("logistics.refreshFleet", {
                    defaultValue: "Обновить автопарк",
                  })}
            </Button>
          </div>
          {fleetError ? (
            <div className="text-sm text-red-600">{fleetError}</div>
          ) : null}
          {vehiclesHint && !availableVehicles.length ? (
            <div className="text-sm text-muted-foreground">{vehiclesHint}</div>
          ) : null}
          {availableVehicles.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] table-fixed border-separate border-spacing-y-1 text-xs sm:text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="rounded-l-md bg-slate-50 px-3 py-2 font-medium uppercase tracking-wide text-[0.7rem] dark:bg-slate-800/70">
                      {t("logistics.vehicleColumnName", {
                        defaultValue: "Транспорт",
                      })}
                    </th>
                    <th className="bg-slate-50 px-3 py-2 font-medium uppercase tracking-wide text-[0.7rem] dark:bg-slate-800/70">
                      {t("logistics.vehicleColumnPlate", {
                        defaultValue: "Госномер",
                      })}
                    </th>
                    <th className="bg-slate-50 px-3 py-2 font-medium uppercase tracking-wide text-[0.7rem] dark:bg-slate-800/70">
                      {t("logistics.vehicleColumnType", {
                        defaultValue: "Тип",
                      })}
                    </th>
                    <th className="bg-slate-50 px-3 py-2 font-medium uppercase tracking-wide text-[0.7rem] dark:bg-slate-800/70">
                      {t("logistics.vehicleColumnTasks", {
                        defaultValue: "Задачи",
                      })}
                    </th>
                    <th className="rounded-r-md bg-slate-50 px-3 py-2 font-medium uppercase tracking-wide text-[0.7rem] dark:bg-slate-800/70">
                      {t("logistics.vehicleColumnMileage", {
                        defaultValue: "Пробег",
                      })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {availableVehicles.map((vehicle) => {
                    const tasksCount = Array.isArray(vehicle.currentTasks)
                      ? vehicle.currentTasks.length
                      : null;
                    const mileageValue =
                      typeof vehicle.odometerCurrent === "number" &&
                      Number.isFinite(vehicle.odometerCurrent)
                        ? vehicle.odometerCurrent
                        : null;
                    return (
                      <tr
                        key={vehicle.id}
                        className="bg-white/80 text-sm shadow-sm dark:bg-slate-900/60"
                      >
                        <td className="rounded-l-md px-3 py-2 font-medium">
                          {vehicle.name ||
                            t("logistics.unselectedVehicle", {
                              defaultValue: "Не выбран",
                            })}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {vehicle.registrationNumber ||
                            t("logistics.assignDialogUnknown", {
                              defaultValue: "нет данных",
                            })}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {vehicle.transportType ||
                            t("logistics.assignDialogUnknown", {
                              defaultValue: "нет данных",
                            })}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {typeof tasksCount === "number"
                            ? t("logistics.vehicleTasksShort", {
                                count: tasksCount,
                                defaultValue: `${tasksCount}`,
                              })
                            : t("logistics.assignDialogUnknown", {
                                defaultValue: "нет данных",
                              })}
                        </td>
                        <td className="rounded-r-md px-3 py-2 text-xs text-muted-foreground">
                          {mileageValue !== null
                            ? t("logistics.vehicleMileageShort", {
                                value: mileageValue,
                                defaultValue: `${mileageValue} км`,
                              })
                            : t("logistics.assignDialogUnknown", {
                                defaultValue: "нет данных",
                              })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : fleetError ? (
        <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">
          {fleetError}
        </p>
      ) : null}
      <section className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-3 rounded border bg-white/80 p-3 shadow-sm">
          <div
            id="logistics-map"
            className={`h-[280px] w-full rounded border ${hasDialog ? "hidden" : ""}`}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  {t("logistics.vehicleCountLabel")}
                </span>
                <select
                  value={vehicles}
                  onChange={(event) => setVehicles(Number(event.target.value))}
                  className="h-8 rounded border px-2 text-sm"
                  aria-label={t("logistics.vehicleCountAria")}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  {t("logistics.optimizeMethodLabel")}
                </span>
                <select
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                  className="h-8 rounded border px-2 text-sm"
                  aria-label={t("logistics.optimizeMethodAria")}
                >
                  <option value="angle">angle</option>
                  <option value="trip">trip</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" onClick={calculate}>
                {t("logistics.optimize")}
              </Button>
              <Button type="button" size="sm" onClick={reset}>
                {t("reset")}
              </Button>
              <Button type="button" size="sm" onClick={refreshAll}>
                {t("refresh")}
              </Button>
            </div>
          </div>
          {clusterSelection?.ids.length ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-dashed border-slate-300 bg-white/70 px-3 py-2 text-xs text-slate-600">
              <span>
                {t("logistics.clusterSelectionSummary", {
                  count: clusterSelection.ids.length,
                  defaultValue: `В кластере задач: ${clusterSelection.ids.length}`,
                })}
              </span>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={handleClearClusterSelection}
              >
                {t("clear")}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="space-y-3">
          <section className="space-y-2 rounded border bg-white/80 p-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {t("logistics.geozonesTitle")}
              </h3>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={handleStartDrawing}
                disabled={!mapReady}
              >
                {isDrawing
                  ? t("logistics.geozonesDrawing")
                  : t("logistics.geozonesDraw")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("logistics.geozonesHint")}
            </p>
            {geoZones.length ? (
              <ul className="space-y-2 text-sm">
                {geoZones.map((zone, index) => {
                  const isActive = activeGeoZoneIds.includes(zone.id);
                  return (
                    <li
                      key={zone.id}
                      className="space-y-2 rounded border bg-white/70 p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={isActive}
                            onChange={(event) =>
                              handleToggleZone(zone.id, event.target.checked)
                            }
                          />
                          <span className="font-medium">
                            {zone.name ||
                              t("logistics.geozoneDefaultName", {
                                index: index + 1,
                              })}
                          </span>
                        </label>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() => handleRemoveZone(zone)}
                        >
                          {t("logistics.geozoneRemove")}
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isActive
                          ? t("logistics.geozoneStatusActive")
                          : t("logistics.geozoneStatusInactive")}
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div>
                          {t("logistics.geozoneArea", {
                            value: formatAreaMetric(zone.metrics?.areaKm2),
                          })}
                        </div>
                        <div>
                          {t("logistics.geozonePerimeter", {
                            value: formatPerimeterMetric(zone.metrics?.perimeterKm),
                          })}
                        </div>
                        <div>
                          {t("logistics.geozoneBuffer", {
                            value: formatBufferMetric(zone.metrics?.bufferMeters),
                          })}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("logistics.geozonesEmpty")}
              </p>
            )}
          </section>
          <section className="space-y-3 rounded border bg-white/80 p-3 shadow-sm">
            <h3 className="text-sm font-semibold">
              {t("logistics.layersTitle")}
            </h3>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={layerVisibility.tasks}
                  onChange={(event) =>
                    setLayerVisibility((prev) => ({
                      ...prev,
                      tasks: event.target.checked,
                    }))
                  }
                />
                <span>{t("logistics.layerTasks")}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={layerVisibility.optimized}
                  onChange={(event) =>
                    setLayerVisibility((prev) => ({
                      ...prev,
                      optimized: event.target.checked,
                    }))
                  }
                />
                <span>{t("logistics.layerOptimization")}</span>
              </label>
            </div>
            <div className="space-y-3 border-t border-dashed border-slate-200 pt-3 text-sm">
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase text-muted-foreground">
                  {t("logistics.layerRouteStatuses", {
                    defaultValue: "Статусы маршрутов",
                  })}
                </legend>
                <ul className="space-y-1">
                  {routeStatusEntries.map(({ key, count, color }) => {
                    const visible = !hiddenRouteStatusesSet.has(key);
                    const label = t(`logistics.routeStatus.${key}`, {
                      defaultValue: ROUTE_STATUS_LABELS[key],
                    });
                    return (
                      <li key={key} className="flex items-center justify-between gap-2">
                        <label className="flex flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={visible}
                            onChange={(event) =>
                              handleRouteStatusVisibilityChange(key, event.target.checked)
                            }
                          />
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block size-3 rounded-full"
                              style={{ backgroundColor: color }}
                              aria-hidden="true"
                            />
                            <span>{label}</span>
                          </span>
                        </label>
                        <span className="text-xs text-muted-foreground">
                          {t("logistics.legendCount", {
                            count,
                            defaultValue: `(${count})`,
                          })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase text-muted-foreground">
                  {t("logistics.layerTransports", {
                    defaultValue: "Типы транспорта",
                  })}
                </legend>
                <ul className="space-y-1">
                  {transportEntries.map(({ key, label, count, color }) => {
                    const visible = !hiddenTransportTypesSet.has(key);
                    return (
                      <li key={key} className="flex items-center justify-between gap-2">
                        <label className="flex flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={visible}
                            onChange={(event) =>
                              handleTransportVisibilityChange(key, event.target.checked)
                            }
                          />
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block size-3 rounded-full"
                              style={{ backgroundColor: color }}
                              aria-hidden="true"
                            />
                            <span>{label}</span>
                          </span>
                        </label>
                        <span className="text-xs text-muted-foreground">
                          {t("logistics.legendCount", {
                            count,
                            defaultValue: `(${count})`,
                          })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase text-muted-foreground">
                  {t("logistics.layerTaskTypes", {
                    defaultValue: "Типы задач",
                  })}
                </legend>
                <ul className="space-y-1">
                  {taskTypeEntries.map(({ key, label, count, color }) => {
                    const visible = !hiddenTaskTypesSet.has(key);
                    return (
                      <li key={key} className="flex items-center justify-between gap-2">
                        <label className="flex flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={visible}
                            onChange={(event) =>
                              handleTaskTypeVisibilityChange(key, event.target.checked)
                            }
                          />
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block size-3 rounded-full"
                              style={{ backgroundColor: color }}
                              aria-hidden="true"
                            />
                            <span>{label}</span>
                          </span>
                        </label>
                        <span className="text-xs text-muted-foreground">
                          {t("logistics.legendCount", {
                            count,
                            defaultValue: `(${count})`,
                          })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            </div>
            <div className="space-y-1 border-t border-dashed border-slate-200 pt-2">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                {t("logistics.viewModeLabel")}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant={mapViewMode === "planar" ? "default" : "outline"}
                  onClick={() => setMapViewMode("planar")}
                  aria-pressed={mapViewMode === "planar"}
                >
                  {t("logistics.viewModePlanar")}
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={mapViewMode === "perspective" ? "default" : "outline"}
                  onClick={() => setMapViewMode("perspective")}
                  aria-pressed={mapViewMode === "perspective"}
                >
                  {t("logistics.viewModeTilted")}
                </Button>
              </div>
            </div>
            {!!links.length && (
              <div className="space-y-1 text-sm">
                {links.map((url, index) => (
                  <a
                    key={`${index}-${url}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accentPrimary underline"
                  >
                    {t("logistics.linksLabel", { index: index + 1 })}
                  </a>
                ))}
              </div>
            )}
          </section>
          <section className="space-y-3 rounded border bg-white/80 p-3 shadow-sm">
            <h3 className="text-sm font-semibold">
              {t("logistics.legendTitle")}
            </h3>
            <div className="space-y-3 text-sm">
              <p className="text-xs text-muted-foreground">
                {t("logistics.legendDescription", {
                  defaultValue:
                    "Заливка маркера соответствует типу транспорта, обводка — статусу маршрута, внутреннее кольцо — типу задачи. Размер и цвет кластера показывают преобладающую категорию.",
                })}
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <span className="legend-symbol legend-symbol--start" aria-hidden="true">
                    {TASK_START_SYMBOL}
                  </span>
                  <span>{t("logistics.legendStart")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="legend-symbol legend-symbol--finish" aria-hidden="true">
                    {TASK_FINISH_SYMBOL}
                  </span>
                  <span>{t("logistics.legendFinish")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="legend-symbol legend-symbol--movement" aria-hidden="true">
                    {ANIMATION_SYMBOL}
                  </span>
                  <span>{t("logistics.legendMovement")}</span>
                </li>
              </ul>
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase text-muted-foreground">
                  {t("logistics.legendStatusesHeading", {
                    defaultValue: "Статусы задач",
                  })}
                </div>
                <ul className="space-y-2">
                  {legendItems.map((item) => (
                    <li key={item.key} className="flex items-center gap-2">
                      <span
                        className="legend-color"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                      {item.count ? (
                        <span className="text-xs text-muted-foreground">
                          {t("logistics.legendCount", {
                            count: item.count,
                            defaultValue: `(${item.count})`,
                          })}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      </section>
      <section className="space-y-2 rounded border bg-white/80 p-3 shadow-sm">
        <h3 className="text-lg font-semibold">
          {t("logistics.tasksHeading")}
        </h3>
        <TaskTable
          tasks={displayedTasks}
          onDataChange={(rows) => setSorted(rows as RouteTask[])}
          onRowClick={openTask}
          page={page}
          pageCount={Math.max(1, Math.ceil(displayedTasks.length / 25))}
          onPageChange={setPage}
        />
      </section>
    </div>
  );
}
