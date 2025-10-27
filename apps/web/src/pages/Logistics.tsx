// Страница отображения логистики с картой, маршрутами и фильтрами
// Основные модули: React, MapLibre GL, Turf, i18next
import React from "react";
import clsx from "clsx";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import {
  area as turfArea,
  booleanPointInPolygon,
  buffer as turfBuffer,
  length as turfLength,
  point,
  polygonToLine,
} from "@turf/turf";
import fetchRouteGeometry from "../services/osrm";
import { fetchTasks } from "../services/tasks";
import optimizeRoute, {
  type OptimizeRoutePayload,
  type RouteOptimizationResult,
} from "../services/optimizer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TaskTable from "../components/TaskTable";
import FleetTable from "../components/FleetTable";
import Modal from "../components/Modal";
import { useTranslation } from "react-i18next";
import L, { type LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
} from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import MapLibreDraw from "maplibre-gl-draw";
import "maplibre-gl-draw/dist/mapbox-gl-draw.css";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import useTasks from "../context/useTasks";
import { useTaskIndex } from "../controllers/taskStateController";
import { listFleetVehicles } from "../services/fleets";
import { subscribeLogisticsEvents } from "../services/logisticsEvents";
import authFetch from "../utils/authFetch";
import {
  PROJECT_TIMEZONE,
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

type RouteTask = TaskRow & {
  startCoordinates?: Coords;
  finishCoordinates?: Coords;
};

type TaskStatusInfo = {
  overloaded: boolean;
  delayed: boolean;
  delayMinutes: number;
  etaMinutes: number | null;
  routeLoad: number | null;
  routeId: string;
  recalculating?: boolean;
};

const parseTaskWeightValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(/,/, ".");
    if (!normalized) {
      return null;
    }
    const parsed = Number.parseFloat(normalized);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
};

const getTaskIdentifier = (task: RouteTask): string => {
  const source = task as Record<string, unknown>;
  const candidates: unknown[] = [
    source["_id"],
    source["id"],
    source["taskId"],
    source["task_id"],
  ];
  const rawId = candidates.find(
    (value) => value !== undefined && value !== null,
  );
  if (typeof rawId === "string") {
    const trimmed = rawId.trim();
    return trimmed ? trimmed : "";
  }
  if (typeof rawId === "number" && Number.isFinite(rawId)) {
    return rawId.toString();
  }
  return "";
};

const getRouteTaskWeight = (task: RouteTask): number | null => {
  const source = task as Record<string, unknown>;
  const direct =
    parseTaskWeightValue(source["cargo_weight_kg"]) ??
    parseTaskWeightValue(source["cargoWeightKg"]) ??
    parseTaskWeightValue(source["weight"]);
  if (direct !== null) {
    return direct;
  }
  const details = source["logistics_details"] as
    | Record<string, unknown>
    | undefined;
  if (details && typeof details === "object") {
    const detailWeight =
      parseTaskWeightValue(details["cargo_weight_kg"]) ??
      parseTaskWeightValue(details["cargoWeightKg"]) ??
      parseTaskWeightValue(details["weight"]) ??
      parseTaskWeightValue(details["payload"]) ??
      parseTaskWeightValue(details["payloadKg"]);
    if (detailWeight !== null) {
      return detailWeight;
    }
  }
  return null;
};

const extractVehicleTaskIds = (vehicle: FleetVehicleDto): string[] => {
  const vehicleSource = vehicle as unknown as Record<string, unknown>;
  const rawTasks = vehicleSource["currentTasks"];
  if (!Array.isArray(rawTasks)) {
    return [];
  }
  const ids = new Set<string>();
  (rawTasks as unknown[]).forEach((entry) => {
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed) {
        ids.add(trimmed);
      }
      return;
    }
    if (typeof entry === "number" && Number.isFinite(entry)) {
      ids.add(entry.toString());
      return;
    }
    if (!entry || typeof entry !== "object") {
      return;
    }
    const source = entry as Record<string, unknown>;
    const rawId =
      source["taskId"] ??
      source["task_id"] ??
      source["id"] ??
      source["task"] ??
      null;
    if (typeof rawId === "string") {
      const trimmed = rawId.trim();
      if (trimmed) {
        ids.add(trimmed);
      }
    } else if (typeof rawId === "number" && Number.isFinite(rawId)) {
      ids.add(rawId.toString());
    }
  });
  return Array.from(ids);
};

const MAPLIBRE_STYLE_URL = "https://demotiles.maplibre.org/style.json";
const MAPLIBRE_POLYGON_SOURCE_ID = "logistics-polygons";
const MAPLIBRE_POLYGON_FILL_LAYER_ID = "logistics-polygons-fill";
const MAPLIBRE_POLYGON_LINE_LAYER_ID = "logistics-polygons-line";
const GEOZONE_BUFFER_METERS = 150;

type MapFeatureCollection = FeatureCollection<Geometry, GeoJsonProperties>;
type PolygonGeometry = Extract<Geometry, { type: "Polygon" }>;
type MultiPolygonGeometry = Extract<Geometry, { type: "MultiPolygon" }>;
type MapPolygonFeature = Feature<
  PolygonGeometry | MultiPolygonGeometry,
  GeoJsonProperties
>;

const EMPTY_FEATURE_COLLECTION: MapFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const POLYGON_GEOMETRY_TYPES = new Set<Geometry["type"]>([
  "Polygon",
  "MultiPolygon",
]);

const cloneFeatureCollection = (
  source: MapFeatureCollection,
): MapFeatureCollection =>
  JSON.parse(JSON.stringify(source)) as MapFeatureCollection;

const getFeatureId = (input?: { id?: unknown }): string | null => {
  if (!input) {
    return null;
  }
  const raw = input.id;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw.toString();
  }
  return null;
};

const isPolygonFeature = (
  feature: MapFeatureCollection["features"][number],
): feature is MapPolygonFeature => {
  if (!feature || typeof feature !== "object") {
    return false;
  }
  const geometry = feature.geometry;
  if (!geometry || typeof geometry !== "object") {
    return false;
  }
  return POLYGON_GEOMETRY_TYPES.has(geometry.type);
};

const isCoordinateInsidePolygons = (
  collection: MapFeatureCollection,
  coords: Coords,
): boolean => {
  const polygons = collection.features.filter(isPolygonFeature);
  if (!polygons.length) {
    return false;
  }
  const geoPoint = point([coords.lng, coords.lat]);
  return polygons.some((polygon) => booleanPointInPolygon(geoPoint, polygon));
};

const buildBufferedFeatureCollection = (
  collection: MapFeatureCollection,
  bufferMeters: number,
): MapFeatureCollection => {
  if (!Number.isFinite(bufferMeters) || bufferMeters <= 0) {
    return cloneFeatureCollection(collection);
  }
  const distanceKm = bufferMeters / 1000;
  const bufferedFeatures = collection.features.map((feature) => {
    if (!isPolygonFeature(feature)) {
      return feature;
    }
    try {
      const buffered = turfBuffer(feature, distanceKm, {
        units: "kilometers",
      });
      if (!buffered || !buffered.geometry) {
        return feature;
      }
      return {
        type: "Feature",
        id: feature.id,
        properties: { ...feature.properties },
        geometry: buffered.geometry,
      } satisfies MapPolygonFeature;
    } catch {
      return feature;
    }
  });
  return { type: "FeatureCollection", features: bufferedFeatures };
};

const calculateGeozoneMetrics = (
  feature: MapPolygonFeature,
): { areaSqKm: number | null; perimeterKm: number | null } => {
  let areaSqKm: number | null = null;
  let perimeterKm: number | null = null;
  try {
    const areaValue = turfArea(feature);
    if (Number.isFinite(areaValue) && areaValue > 0) {
      areaSqKm = areaValue / 1_000_000;
    }
  } catch {
    areaSqKm = null;
  }
  try {
    const line = polygonToLine(feature);
    const perimeterValue = turfLength(line, { units: "kilometers" });
    if (Number.isFinite(perimeterValue) && perimeterValue > 0) {
      perimeterKm = perimeterValue;
    }
  } catch {
    perimeterKm = null;
  }
  return { areaSqKm, perimeterKm };
};

const collectTaskPoints = (task: RouteTask): Coords[] => {
  const points: Coords[] = [];
  if (hasPoint(task.startCoordinates)) {
    points.push(task.startCoordinates as Coords);
  }
  if (hasPoint(task.finishCoordinates)) {
    points.push(task.finishCoordinates as Coords);
  }
  return points;
};

const isTaskInsidePolygons = (
  task: RouteTask,
  polygons: MapFeatureCollection,
): boolean => {
  const points = collectTaskPoints(task);
  if (!points.length) {
    return false;
  }
  return points.some((coords) => isCoordinateInsidePolygons(polygons, coords));
};

const hasPolygonGeometry = (collection: MapFeatureCollection) =>
  collection.features.some(isPolygonFeature);

type DrawEventPayload = {
  features?: Array<Feature<Geometry, GeoJsonProperties>>;
};

const areFeatureCollectionsEqual = (
  left: MapFeatureCollection,
  right: MapFeatureCollection,
): boolean => {
  if (left.features.length !== right.features.length) {
    return false;
  }
  for (let index = 0; index < left.features.length; index += 1) {
    const leftFeature = left.features[index];
    const rightFeature = right.features[index];
    if (!leftFeature || !rightFeature) {
      return false;
    }
    if (JSON.stringify(leftFeature) !== JSON.stringify(rightFeature)) {
      return false;
    }
  }
  return true;
};

const normalizeVehicleCapacity = (vehicle: FleetVehicleDto): number | null => {
  const raw = vehicle.payloadCapacityKg;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return null;
  }
  return raw;
};

type DragData =
  | { type: "task"; routeIndex: number; index: number }
  | { type: "route"; routeIndex: number };

type SortableTaskCardProps = {
  id: string;
  task: RoutePlan["routes"][number]["tasks"][number];
  routeIndex: number;
  taskIndex: number;
  t: ReturnType<typeof useTranslation>["t"];
  formatLoad: (value: number | null | undefined) => string;
  formatEta: (value: number | null | undefined) => string;
  formatDelay: (value: number | null | undefined) => string;
  formatDistance: (value: number | null | undefined) => string;
  taskStatus: Map<string, TaskStatusInfo>;
  loadValue: number | null;
  etaValue: number | null;
  isPlanEditable: boolean;
  planLoading: boolean;
};

function SortableTaskCard({
  id,
  task,
  routeIndex,
  taskIndex,
  t,
  formatLoad,
  formatEta,
  formatDelay,
  formatDistance,
  taskStatus,
  loadValue,
  etaValue,
  isPlanEditable,
  planLoading,
}: SortableTaskCardProps) {
  const canDrag = isPlanEditable && !planLoading;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id,
    data: { type: "task", routeIndex, index: taskIndex } satisfies DragData,
    disabled: !canDrag,
  });
  const status = taskStatus.get(task.taskId);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const cardClass = clsx(
    "space-y-2 rounded border px-3 py-2 text-sm shadow-sm bg-white",
    {
      "border-red-300 bg-red-50": status?.delayed,
      "border-amber-300 bg-amber-50": !status?.delayed && status?.overloaded,
      "border-indigo-300 bg-indigo-50": status?.recalculating,
      "ring-2 ring-indigo-200": (isDragging || isOver) && canDrag,
    },
  );
  const handleClass = clsx(
    "flex h-8 w-8 shrink-0 items-center justify-center rounded border bg-slate-50 text-slate-500 transition",
    canDrag
      ? "cursor-grab hover:bg-slate-100"
      : "cursor-not-allowed opacity-60",
  );
  const dragAttributes = canDrag ? attributes : {};
  const dragListeners = canDrag ? listeners : {};

  return (
    <li ref={setNodeRef} style={style} className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <button
            type="button"
            className={handleClass}
            aria-label={t("logistics.planTaskDragHandle")}
            disabled={!canDrag}
            {...dragAttributes}
            {...dragListeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div>
            <div className="font-medium">{task.title ?? task.taskId}</div>
            <div className="text-muted-foreground text-xs">
              {t("task")}: {task.taskId}
            </div>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-[11px] tracking-wide uppercase">
              <span>{t("logistics.loadLabel")}:</span>
              <span className="font-semibold">
                {formatLoad(
                  taskStatus.get(task.taskId)?.routeLoad ?? loadValue,
                )}
              </span>
              <span>•</span>
              <span>{t("logistics.etaLabel")}:</span>
              <span className="font-semibold">
                {formatEta(taskStatus.get(task.taskId)?.etaMinutes ?? etaValue)}
              </span>
              <span>•</span>
              <span
                className={clsx(
                  taskStatus.get(task.taskId)?.delayed
                    ? "text-red-600"
                    : "text-emerald-600",
                )}
              >
                {formatDelay(taskStatus.get(task.taskId)?.delayMinutes ?? null)}
              </span>
            </div>
            {status?.recalculating ? (
              <span className="mt-2 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-indigo-700 uppercase">
                {t("logistics.taskRecalculating")}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="text-muted-foreground space-y-1 text-xs">
        {task.startAddress ? (
          <div>
            <span className="font-medium">{t("startPoint")}:</span>{" "}
            {task.startAddress}
          </div>
        ) : null}
        {task.finishAddress ? (
          <div>
            <span className="font-medium">{t("endPoint")}:</span>{" "}
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
  );
}

type RouteTaskListProps = {
  route: RoutePlan["routes"][number];
  routeIndex: number;
  t: ReturnType<typeof useTranslation>["t"];
  formatLoad: (value: number | null | undefined) => string;
  formatEta: (value: number | null | undefined) => string;
  formatDelay: (value: number | null | undefined) => string;
  formatDistance: (value: number | null | undefined) => string;
  taskStatus: Map<string, TaskStatusInfo>;
  loadValue: number | null;
  etaValue: number | null;
  isPlanEditable: boolean;
  planLoading: boolean;
};

function RouteTaskList({
  route,
  routeIndex,
  t,
  formatLoad,
  formatEta,
  formatDelay,
  formatDistance,
  taskStatus,
  loadValue,
  etaValue,
  isPlanEditable,
  planLoading,
}: RouteTaskListProps) {
  const droppableActive = isPlanEditable && !planLoading;
  const { setNodeRef, isOver } = useDroppable({
    id: `route-droppable-${routeIndex}`,
    data: { type: "route", routeIndex } satisfies DragData,
    disabled: !droppableActive,
  });
  const sortableItems = React.useMemo(
    () =>
      route.tasks.map((task, index) => task.taskId || `${routeIndex}-${index}`),
    [route.tasks, routeIndex],
  );

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "space-y-2 rounded border border-transparent p-2 transition-colors",
        {
          "border-indigo-300 bg-indigo-50/80": isOver && droppableActive,
        },
      )}
    >
      <SortableContext
        items={sortableItems}
        strategy={verticalListSortingStrategy}
      >
        <ul className="space-y-2">
          {route.tasks.length
            ? route.tasks.map((task, taskIndex) => (
                <SortableTaskCard
                  key={sortableItems[taskIndex]}
                  id={sortableItems[taskIndex]}
                  task={task}
                  routeIndex={routeIndex}
                  taskIndex={taskIndex}
                  t={t}
                  formatLoad={formatLoad}
                  formatEta={formatEta}
                  formatDelay={formatDelay}
                  formatDistance={formatDistance}
                  taskStatus={taskStatus}
                  loadValue={loadValue}
                  etaValue={etaValue}
                  isPlanEditable={isPlanEditable}
                  planLoading={planLoading}
                />
              ))
            : null}
        </ul>
      </SortableContext>
      {route.tasks.length === 0 ? (
        <div
          className={clsx(
            "text-muted-foreground rounded border border-dashed px-3 py-2 text-sm",
            {
              "border-indigo-400 bg-indigo-50 text-indigo-700":
                isOver && droppableActive,
            },
          )}
        >
          {t("logistics.planDropAllowed")}
        </div>
      ) : null}
    </div>
  );
}

const TASK_STATUS_COLORS: Record<string, string> = {
  Новая: "#0ea5e9",
  "В работе": "#f97316",
  Выполнена: "#22c55e",
  Отменена: "#ef4444",
};

type LayerVisibilityState = {
  tasks: boolean;
  optimized: boolean;
  transport: boolean;
  traffic: boolean;
  cargo: boolean;
};

const DEFAULT_LAYER_VISIBILITY: LayerVisibilityState = {
  tasks: true,
  optimized: true,
  transport: true,
  traffic: false,
  cargo: false,
};

const LOAD_WARNING_RATIO = 0.85;
const ETA_WARNING_RATIO = 0.9;
const ETA_WARNING_MINUTES = 480;

const loadFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

type LogisticsDetails = {
  transport_type?: string | null;
  start_location?: string | null;
  end_location?: string | null;
};

const MAP_CENTER: [number, number] = [48.3794, 31.1656];
const MAP_ZOOM = 6;
const UKRAINE_BOUNDS: LatLngBoundsExpression = [
  [44, 22],
  [52.5, 40.5],
];

const TRAFFIC_TILE_URL =
  "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png";
const CARGO_TILE_URL = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";

const WINDOW_FULL_DAY: [number, number] = [0, 24 * 60];

const timePartFormatter = new Intl.DateTimeFormat("uk-UA", {
  timeZone: PROJECT_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const positionTimeFormatter = new Intl.DateTimeFormat("uk-UA", {
  timeZone: PROJECT_TIMEZONE,
  dateStyle: "short",
  timeStyle: "short",
});

const extractWindowMinutes = (value?: string | null): number | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = timePartFormatter.formatToParts(date);
  const hourPart = parts.find((part) => part.type === "hour")?.value;
  const minutePart = parts.find((part) => part.type === "minute")?.value;
  if (!hourPart || !minutePart) return null;
  const hours = Number.parseInt(hourPart, 10);
  const minutes = Number.parseInt(minutePart, 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
};

const buildTimeWindow = (
  start?: string | null,
  end?: string | null,
): [number, number] | undefined => {
  const startMinutes = extractWindowMinutes(start);
  const endMinutes = extractWindowMinutes(end);
  if (startMinutes === null && endMinutes === null) {
    return undefined;
  }
  const safeStart = startMinutes ?? WINDOW_FULL_DAY[0];
  const safeEnd = endMinutes ?? WINDOW_FULL_DAY[1];
  return [safeStart, Math.max(safeStart, safeEnd)];
};

const hasPoint = (coords?: Coords | null) =>
  typeof coords?.lat === "number" &&
  Number.isFinite(coords.lat) &&
  typeof coords?.lng === "number" &&
  Number.isFinite(coords.lng);

export default function LogisticsPage() {
  const { t, i18n } = useTranslation();
  const tRef = React.useRef(t);
  React.useEffect(() => {
    tRef.current = t;
  }, [t]);
  const language = i18n.language;
  const tasks = useTaskIndex("logistics:all") as RouteTask[];
  const [sorted, setSorted] = React.useState<RouteTask[]>([]);
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
  const mapRef = React.useRef<L.Map | null>(null);
  const optLayerRef = React.useRef<L.LayerGroup | null>(null);
  const tasksLayerRef = React.useRef<L.LayerGroup | null>(null);
  const vehicleLayerRef = React.useRef<L.LayerGroup | null>(null);
  const trafficLayerRef = React.useRef<L.TileLayer | null>(null);
  const cargoLayerRef = React.useRef<L.TileLayer | null>(null);
  const autoJobRef = React.useRef({
    refreshTasks: false,
    refreshPlan: false,
    recalc: false,
  });
  const autoTimerRef = React.useRef<number | null>(null);
  const [availableVehicles, setAvailableVehicles] = React.useState<
    FleetVehicleDto[]
  >([]);
  const [fleetError, setFleetError] = React.useState("");
  const [vehiclesHint, setVehiclesHint] = React.useState("");
  const [vehiclesLoading, setVehiclesLoading] = React.useState(false);
  const [visibleLayers, setVisibleLayers] =
    React.useState<LayerVisibilityState>(DEFAULT_LAYER_VISIBILITY);
  const [vehiclePositions, setVehiclePositions] = React.useState<
    Record<
      string,
      {
        coordinates: Coords;
        updatedAt: string | null;
        speedKph: number | null;
      }
    >
  >({});
  const [isMapExpanded, setIsMapExpanded] = React.useState(false);
  const [mapReady, setMapReady] = React.useState(false);
  const mapLibreContainerRef = React.useRef<HTMLDivElement | null>(null);
  const mapLibreRef = React.useRef<maplibregl.Map | null>(null);
  const drawControlRef = React.useRef<MapLibreDraw | null>(null);
  const [mapLibreReady, setMapLibreReady] = React.useState(false);
  const [drawnPolygons, setDrawnPolygons] =
    React.useState<MapFeatureCollection>(() =>
      cloneFeatureCollection(EMPTY_FEATURE_COLLECTION),
    );
  const drawnPolygonsRef = React.useRef(drawnPolygons);
  const bufferedPolygons = React.useMemo(
    () => buildBufferedFeatureCollection(drawnPolygons, GEOZONE_BUFFER_METERS),
    [drawnPolygons],
  );
  const bufferedPolygonsRef = React.useRef(bufferedPolygons);
  const geozoneChangeInitRef = React.useRef(false);
  const [activeGeozoneId, setActiveGeozoneId] = React.useState<string | null>(
    null,
  );
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const hasLoadedFleetRef = React.useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const hasDialog = params.has("task") || params.has("newTask");
  const { user } = useAuth();
  const { controller } = useTasks();
  const role = user?.role ?? null;
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const [planSyncing, setPlanSyncing] = React.useState(false);
  const [recalcInProgress, setRecalcInProgress] = React.useState(false);
  const [assignVehicle, setAssignVehicle] =
    React.useState<FleetVehicleDto | null>(null);
  const [assignSelected, setAssignSelected] = React.useState<string[]>([]);
  const [assignLoading, setAssignLoading] = React.useState(false);
  const [assignError, setAssignError] = React.useState("");
  const [assignResult, setAssignResult] =
    React.useState<RouteOptimizationResult | null>(null);

  React.useEffect(() => {
    drawnPolygonsRef.current = drawnPolygons;
  }, [drawnPolygons]);

  React.useEffect(() => {
    bufferedPolygonsRef.current = bufferedPolygons;
  }, [bufferedPolygons]);

  const geozoneFeatures = React.useMemo(
    () => drawnPolygons.features.filter(isPolygonFeature),
    [drawnPolygons],
  );

  const geozoneItems = React.useMemo(
    () =>
      geozoneFeatures.map((feature, index) => {
        const id = getFeatureId(feature);
        const nameProperty =
          typeof feature?.properties?.name === "string"
            ? feature.properties.name.trim()
            : "";
        const label =
          nameProperty ||
          t("logistics.geozoneDefaultName", {
            index: index + 1,
            defaultValue: `Геозона ${index + 1}`,
          });
        const metrics = calculateGeozoneMetrics(feature);
        return {
          key: id ?? `zone-${index}`,
          id,
          label,
          active: Boolean(id) && id === activeGeozoneId,
          areaSqKm: metrics.areaSqKm,
          perimeterKm: metrics.perimeterKm,
        };
      }),
    [activeGeozoneId, geozoneFeatures, t],
  );

  const zoneFilter = React.useMemo(() => {
    if (!hasPolygonGeometry(bufferedPolygons)) {
      return { tasks, ids: null as Set<string> | null };
    }
    const filtered = tasks.filter((task) =>
      isTaskInsidePolygons(task, bufferedPolygons),
    );
    const ids = new Set<string>();
    filtered.forEach((task) => {
      const taskId = getTaskIdentifier(task);
      if (taskId) {
        ids.add(taskId);
      }
    });
    return { tasks: filtered, ids };
  }, [bufferedPolygons, tasks]);

  const displayedTasks = zoneFilter.tasks;
  const zoneTaskIds = zoneFilter.ids;

  React.useEffect(() => {
    setPage((current) => {
      const maxPage = Math.max(0, Math.ceil(displayedTasks.length / 25) - 1);
      return Math.min(current, maxPage);
    });
  }, [displayedTasks.length]);

  const handleSelectGeozone = React.useCallback((id: string | null) => {
    const drawControl = drawControlRef.current;
    if (drawControl) {
      if (id) {
        drawControl.changeMode("simple_select", { featureIds: [id] });
      } else {
        drawControl.changeMode("simple_select", { featureIds: [] });
      }
    }
    setActiveGeozoneId(id);
  }, []);

  const handleDeleteGeozone = React.useCallback((id: string) => {
    if (!id) {
      return;
    }
    const drawControl = drawControlRef.current;
    if (drawControl) {
      drawControl.delete(id);
      const updated = cloneFeatureCollection(
        drawControl.getAll() as MapFeatureCollection,
      );
      setDrawnPolygons(updated);
      setActiveGeozoneId((current) => (current === id ? null : current));
      const map = mapLibreRef.current;
      const source = map?.getSource(
        MAPLIBRE_POLYGON_SOURCE_ID,
      ) as GeoJSONSource | undefined;
      source?.setData(updated);
      return;
    }
    setDrawnPolygons((current) => {
      const next: MapFeatureCollection = {
        type: "FeatureCollection",
        features: current.features.filter(
          (feature) => getFeatureId(feature) !== id,
        ),
      };
      const map = mapLibreRef.current;
      const source = map?.getSource(
        MAPLIBRE_POLYGON_SOURCE_ID,
      ) as GeoJSONSource | undefined;
      source?.setData(next);
      return next;
    });
    setActiveGeozoneId((current) => (current === id ? null : current));
  }, []);

  const handleClearGeozones = React.useCallback(() => {
    const drawControl = drawControlRef.current;
    if (drawControl) {
      drawControl.deleteAll();
    }
    setDrawnPolygons((current) => {
      if (!current.features.length) {
        return current;
      }
      const next = cloneFeatureCollection(EMPTY_FEATURE_COLLECTION);
      const map = mapLibreRef.current;
      const source = map?.getSource(
        MAPLIBRE_POLYGON_SOURCE_ID,
      ) as GeoJSONSource | undefined;
      source?.setData(next);
      return next;
    });
    setActiveGeozoneId(null);
  }, []);

  const legendItems = React.useMemo(
    () =>
      TASK_STATUSES.map((status) => ({
        key: status,
        label: status,
        color: TASK_STATUS_COLORS[status] ?? "#2563eb",
      })),
    [],
  );

  const taskIndex = React.useMemo(
    () => new Map(sorted.map((task) => [task._id, task])),
    [sorted],
  );

  const buildPlanFromOptimization = React.useCallback(
    (result: RouteOptimizationResult): RoutePlan | null => {
      if (!result.routes.length) {
        return null;
      }
      const planRoutes: RoutePlan["routes"] = [];

      result.routes.forEach((route, routeIndex) => {
        const tasksForRoute = route.taskIds
          .map((id) => taskIndex.get(id))
          .filter((task): task is RouteTask => Boolean(task));

        if (!tasksForRoute.length) {
          return;
        }

        const taskRefs = tasksForRoute.map((task, order) => {
          const details = (task as Record<string, unknown>)
            .logistics_details as LogisticsDetails | undefined;
          const startAddress =
            typeof details?.start_location === "string"
              ? details.start_location.trim()
              : "";
          const finishAddress =
            typeof details?.end_location === "string"
              ? details.end_location.trim()
              : "";
          const windowStart =
            typeof (task as Record<string, unknown>).delivery_window_start ===
            "string"
              ? ((task as Record<string, unknown>)
                  .delivery_window_start as string)
              : null;
          const windowEnd =
            typeof (task as Record<string, unknown>).delivery_window_end ===
            "string"
              ? ((task as Record<string, unknown>)
                  .delivery_window_end as string)
              : null;
          const distance = Number(task.route_distance_km);
          return {
            taskId: task._id,
            order,
            title: task.title,
            start: task.startCoordinates,
            finish: task.finishCoordinates,
            startAddress: startAddress || null,
            finishAddress: finishAddress || null,
            distanceKm:
              Number.isFinite(distance) && !Number.isNaN(distance)
                ? distance
                : null,
            windowStart,
            windowEnd,
          } satisfies RoutePlan["routes"][number]["tasks"][number];
        });

        const stops = taskRefs.flatMap((taskRef) => {
          const routeStops: RoutePlan["routes"][number]["stops"] = [];
          if (taskRef.start) {
            routeStops.push({
              order: taskRef.order * 2,
              kind: "start",
              taskId: taskRef.taskId,
              coordinates: taskRef.start,
              address: taskRef.startAddress ?? null,
            });
          }
          if (taskRef.finish) {
            routeStops.push({
              order: taskRef.order * 2 + 1,
              kind: "finish",
              taskId: taskRef.taskId,
              coordinates: taskRef.finish,
              address: taskRef.finishAddress ?? null,
            });
          }
          return routeStops;
        });

        const planRoute: RoutePlan["routes"][number] = {
          id: `route-${routeIndex + 1}`,
          order: routeIndex,
          vehicleId: null,
          vehicleName: null,
          driverId: null,
          driverName: null,
          tasks: taskRefs,
          stops,
          metrics: {
            distanceKm: route.distanceKm,
            etaMinutes: route.etaMinutes,
            load: route.load,
            tasks: taskRefs.length,
            stops: stops.length,
          },
          routeLink: null,
          notes: null,
        };

        planRoutes.push(planRoute);
      });

      if (!planRoutes.length) {
        return null;
      }

      const totalTasks = planRoutes.reduce(
        (sum, route) => sum + route.tasks.length,
        0,
      );
      const totalStops = planRoutes.reduce(
        (sum, route) => sum + (route.metrics?.stops ?? 0),
        0,
      );

      return {
        id: "optimization-draft",
        title: "Черновик оптимизации",
        status: "draft",
        suggestedBy: null,
        method: undefined,
        count: result.routes.length,
        notes: null,
        approvedBy: null,
        approvedAt: null,
        completedBy: null,
        completedAt: null,
        metrics: {
          totalDistanceKm: result.totalDistanceKm,
          totalRoutes: planRoutes.length,
          totalTasks,
          totalStops,
          totalEtaMinutes: result.totalEtaMinutes,
          totalLoad: result.totalLoad,
        },
        routes: planRoutes,
        tasks: planRoutes.flatMap((route) =>
          route.tasks.map((task) => task.taskId),
        ),
        createdAt: undefined,
        updatedAt: undefined,
      } satisfies RoutePlan;
    },
    [taskIndex],
  );

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
    setPlanMessage("");
    setPlanMessageTone("neutral");
    try {
      const drafts = await listRoutePlans("draft", 1, 1);
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
      setPlanMessage(tRef.current("logistics.planEmpty"));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tRef.current("logistics.planLoadError");
      setPlanMessage(message);
      setPlanMessageTone("error");
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
      updater: (
        route: RoutePlan["routes"][number],
      ) => RoutePlan["routes"][number],
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
    setPlanDraft((current) =>
      current ? { ...current, title: value } : current,
    );
  }, []);

  const handlePlanNotesChange = React.useCallback((value: string) => {
    setPlanDraft((current) =>
      current ? { ...current, notes: value } : current,
    );
  }, []);

  const handleDriverNameChange = React.useCallback(
    (routeIndex: number, value: string) => {
      updateRouteDraft(routeIndex, (route) => ({
        ...route,
        driverName: value,
      }));
    },
    [updateRouteDraft],
  );

  const handleVehicleNameChange = React.useCallback(
    (routeIndex: number, value: string) => {
      updateRouteDraft(routeIndex, (route) => ({
        ...route,
        vehicleName: value,
      }));
    },
    [updateRouteDraft],
  );

  const handleRouteNotesChange = React.useCallback(
    (routeIndex: number, value: string) => {
      updateRouteDraft(routeIndex, (route) => ({
        ...route,
        notes: value || null,
      }));
    },
    [updateRouteDraft],
  );

  const handleSavePlan = React.useCallback(async () => {
    if (!planDraft) return;
    setPlanLoading(true);
    try {
      const payload = buildUpdatePayload(planDraft);
      const updated = await updateRoutePlan(planDraft.id, payload);
      applyPlan(updated);
      setPlanMessage(tRef.current("logistics.planSaved"));
      setPlanMessageTone("success");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tRef.current("logistics.planSaveError");
      setPlanMessage(message);
      setPlanMessageTone("error");
    } finally {
      setPlanLoading(false);
    }
  }, [planDraft, buildUpdatePayload, applyPlan]);

  const handleApprovePlan = React.useCallback(async () => {
    if (!planDraft) return;
    setPlanLoading(true);
    try {
      const updated = await changeRoutePlanStatus(planDraft.id, "approved");
      applyPlan(updated);
      setPlanMessage(tRef.current("logistics.planPublished"));
      setPlanMessageTone("success");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tRef.current("logistics.planStatusError");
      setPlanMessage(message);
      setPlanMessageTone("error");
    } finally {
      setPlanLoading(false);
    }
  }, [planDraft, applyPlan]);

  const handleCompletePlan = React.useCallback(async () => {
    if (!planDraft) return;
    setPlanLoading(true);
    try {
      const updated = await changeRoutePlanStatus(planDraft.id, "completed");
      applyPlan(updated);
      setPlanMessage(tRef.current("logistics.planCompleted"));
      setPlanMessageTone("success");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tRef.current("logistics.planStatusError");
      setPlanMessage(message);
      setPlanMessageTone("error");
    } finally {
      setPlanLoading(false);
    }
  }, [planDraft, applyPlan]);

  const handleReloadPlan = React.useCallback(async () => {
    setPlanMessage("");
    setPlanMessageTone("neutral");
    await loadPlan();
  }, [loadPlan]);

  const handleClearPlan = React.useCallback(() => {
    applyPlan(null);
    setPlanMessage(tRef.current("logistics.planEmpty"));
    setPlanMessageTone("neutral");
  }, [applyPlan]);

  React.useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  React.useEffect(() => {
    const translate = tRef.current;
    const title = translate("appTitle");
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

  const handleTableDataChange = React.useCallback(
    (rows: TaskRow[]) => {
      if (!rows.length) {
        setSorted([]);
        return;
      }
      if (!zoneTaskIds) {
        setSorted(rows as RouteTask[]);
        return;
      }
      const filtered = (rows as RouteTask[]).filter((task) => {
        const id = getTaskIdentifier(task);
        return id ? zoneTaskIds.has(id) : false;
      });
      setSorted(filtered);
    },
    [zoneTaskIds],
  );

  const filterRouteTasks = React.useCallback((input: RouteTask[]) => {
    return input.filter((task) => {
      const details = (task as Record<string, unknown>).logistics_details as
        | LogisticsDetails
        | undefined;
      const transportTypeRaw =
        typeof details?.transport_type === "string"
          ? details.transport_type.trim()
          : "";
      const normalizedTransportType = transportTypeRaw.toLowerCase();
      const hasTransportType =
        Boolean(transportTypeRaw) &&
        normalizedTransportType !== "без транспорта";

      if (!hasTransportType) {
        return false;
      }

      const hasCoordinates =
        hasPoint(task.startCoordinates) || hasPoint(task.finishCoordinates);
      const hasAddresses =
        (typeof details?.start_location === "string" &&
          details.start_location.trim().length > 0) ||
        (typeof details?.end_location === "string" &&
          details.end_location.trim().length > 0);

      return hasCoordinates || hasAddresses;
    });
  }, []);

  const load = React.useCallback(async () => {
    const userId = Number((user as any)?.telegram_id) || undefined;
    try {
      const data = await fetchTasks({}, userId, true);
      const rawSource = data as unknown;
      let raw: Array<Record<string, unknown>> = [];
      if (Array.isArray(rawSource)) {
        raw = rawSource as Array<Record<string, unknown>>;
      } else {
        const response = rawSource as {
          tasks?: unknown;
          items?: unknown;
          data?: unknown;
        };
        if (Array.isArray(response.tasks)) {
          raw = response.tasks as Array<Record<string, unknown>>;
        } else if (Array.isArray(response.items)) {
          raw = response.items as Array<Record<string, unknown>>;
        } else if (Array.isArray(response.data)) {
          raw = response.data as Array<Record<string, unknown>>;
        }
      }
      const mapped: Array<RouteTask | null> = raw.map((item) => {
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
      const list = mapped.filter((task): task is RouteTask => Boolean(task));
      const filtered = filterRouteTasks(list);
      controller.setIndex("logistics:all", filtered, {
        kind: "task",
        mine: false,
        userId,
        pageSize: filtered.length,
        total: filtered.length,
        sort: "desc",
      });
      setSorted(filtered);
      return filtered;
    } catch (error) {
      console.error("Не удалось загрузить задачи логистики", error);
      setSorted([]);
      controller.setIndex("logistics:all", [], {
        kind: "task",
        mine: false,
        userId,
        pageSize: 0,
        total: 0,
        sort: "desc",
      });
      return [];
    }
  }, [controller, filterRouteTasks, user]);

  const loadFleetVehicles = React.useCallback(async () => {
    if (role !== "admin") return;
    setVehiclesLoading(true);
    setVehiclesHint("");
    setFleetError("");
    try {
      const data = await listFleetVehicles({ page: 1, limit: 100 });
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
    void load();
    if (role === "admin") {
      void loadFleetVehicles();
    }
  }, [load, loadFleetVehicles, role]);

  const refreshFleet = React.useCallback(() => {
    if (role === "admin") {
      void loadFleetVehicles();
    }
  }, [loadFleetVehicles, role]);

  const formatEta = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return tRef.current("logistics.planNoEta");
      }
      const safeValue = Math.max(0, Math.round(value));
      const hours = Math.floor(safeValue / 60);
      const minutes = safeValue % 60;
      const parts: string[] = [];
      if (hours > 0) {
        parts.push(tRef.current("logistics.etaHours", { count: hours }));
      }
      if (minutes > 0 || parts.length === 0) {
        parts.push(tRef.current("logistics.etaMinutes", { count: minutes }));
      }
      return parts.join(" ");
    },
    [tRef],
  );

  const formatLoad = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return tRef.current("logistics.planNoLoad");
      }
      const normalized = Math.max(0, Number(value.toFixed(1)));
      return tRef.current("logistics.loadValue", {
        value: loadFormatter.format(normalized),
      });
    },
    [tRef],
  );

  const formatDelay = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return tRef.current("logistics.onTime");
      }
      return tRef.current("logistics.delayLabel", {
        minutes: Math.max(1, Math.round(value)),
      });
    },
    [tRef],
  );

  const formatWindow = React.useCallback(
    (start?: number | null, end?: number | null) => {
      const toLabel = (input?: number | null) => {
        if (typeof input !== "number" || !Number.isFinite(input)) {
          return null;
        }
        const safe = Math.max(0, Math.round(input));
        const hours = Math.floor(safe / 60)
          .toString()
          .padStart(2, "0");
        const minutes = (safe % 60).toString().padStart(2, "0");
        return `${hours}:${minutes}`;
      };
      const startLabel = toLabel(start ?? null);
      const endLabel = toLabel(end ?? null);
      if (startLabel && endLabel) {
        return `${startLabel} – ${endLabel}`;
      }
      if (startLabel) {
        return tRef.current("logistics.windowFrom", { value: startLabel });
      }
      if (endLabel) {
        return tRef.current("logistics.windowTo", { value: endLabel });
      }
      return tRef.current("logistics.windowUnknown");
    },
    [tRef],
  );

  const formatDistance = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return `${value.toFixed(1)} ${tRef.current("km")}`;
      }
      return tRef.current("logistics.planNoDistance");
    },
    [tRef],
  );

  const areaFormatter = React.useMemo(
    () => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }),
    [],
  );
  const hectareFormatter = React.useMemo(
    () => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }),
    [],
  );
  const kmFormatter = React.useMemo(
    () => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }),
    [],
  );
  const meterFormatter = React.useMemo(
    () => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }),
    [],
  );

  const formatGeozoneArea = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return tRef.current("logistics.geozoneAreaUnknown");
      }
      if (value >= 1) {
        return tRef.current("logistics.geozoneArea", {
          value: `${areaFormatter.format(value)} ${tRef.current("km2")}`,
        });
      }
      const hectares = value * 100;
      return tRef.current("logistics.geozoneArea", {
        value: `${hectareFormatter.format(hectares)} ${tRef.current(
          "hectare",
        )}`,
      });
    },
    [areaFormatter, hectareFormatter, tRef],
  );

  const formatGeozonePerimeter = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return tRef.current("logistics.geozonePerimeterUnknown");
      }
      if (value >= 1) {
        return tRef.current("logistics.geozonePerimeter", {
          value: `${kmFormatter.format(value)} ${tRef.current("km")}`,
        });
      }
      const meters = value * 1000;
      return tRef.current("logistics.geozonePerimeter", {
        value: `${meterFormatter.format(meters)} ${tRef.current("meter")}`,
      });
    },
    [kmFormatter, meterFormatter, tRef],
  );

  const geozoneBufferLabel = React.useMemo(() => {
    if (GEOZONE_BUFFER_METERS <= 0) {
      return "";
    }
    return t("logistics.geozoneBuffer", {
      value: `${meterFormatter.format(GEOZONE_BUFFER_METERS)} ${t("meter")}`,
    });
  }, [meterFormatter, t]);

  const optimizationVehicleCapacity = React.useMemo(() => {
    const validVehicles = availableVehicles.reduce<
      { id: string; capacity: number }[]
    >((acc, vehicle) => {
      const capacity = normalizeVehicleCapacity(vehicle);
      const id = typeof vehicle.id === "string" ? vehicle.id.trim() : "";
      if (!capacity || !id) {
        return acc;
      }
      acc.push({ id, capacity });
      return acc;
    }, []);

    if (!validVehicles.length) {
      return undefined;
    }

    const selectedIds = new Set(
      (planDraft?.routes ?? [])
        .map((route) =>
          typeof route.vehicleId === "string" ? route.vehicleId.trim() : "",
        )
        .filter(Boolean),
    );

    if (selectedIds.size) {
      const selectedCapacities = validVehicles
        .filter((vehicle) => selectedIds.has(vehicle.id))
        .map((vehicle) => vehicle.capacity);
      if (selectedCapacities.length) {
        return Math.min(...selectedCapacities);
      }
    }

    const fallbackCount = Math.max(1, vehicles);
    const fallbackCapacities = validVehicles
      .slice(0, fallbackCount)
      .map((vehicle) => vehicle.capacity);
    if (fallbackCapacities.length) {
      return Math.min(...fallbackCapacities);
    }

    return undefined;
  }, [availableVehicles, planDraft, vehicles]);

  const buildOptimizeTasks = React.useCallback((sourceTasks: RouteTask[]) => {
    const polygons = bufferedPolygonsRef.current;
    const shouldFilterByZone = hasPolygonGeometry(polygons);
    return sourceTasks.reduce<OptimizeRoutePayload["tasks"]>((acc, task) => {
      const taskId = getTaskIdentifier(task);
      if (!taskId) {
        return acc;
      }
      const hasStartPoint = hasPoint(task.startCoordinates);
      const hasFinishPoint = hasPoint(task.finishCoordinates);
      if (!hasStartPoint && !hasFinishPoint) {
        return acc;
      }
      if (shouldFilterByZone) {
        if (!isTaskInsidePolygons(task, polygons)) {
          return acc;
        }
      }
      const useDropPoint = !hasStartPoint && hasFinishPoint;
      const coordinates = (
        useDropPoint ? task.finishCoordinates : task.startCoordinates
      ) as Coords;
      const details = (task as Record<string, unknown>).logistics_details as
        | LogisticsDetails
        | undefined;
      const startAddress =
        typeof details?.start_location === "string"
          ? details.start_location.trim()
          : "";
      const finishAddress =
        typeof details?.end_location === "string"
          ? details.end_location.trim()
          : "";
      const windowStartRaw =
        typeof (task as Record<string, unknown>).delivery_window_start ===
        "string"
          ? ((task as Record<string, unknown>).delivery_window_start as string)
          : null;
      const windowEndRaw =
        typeof (task as Record<string, unknown>).delivery_window_end ===
        "string"
          ? ((task as Record<string, unknown>).delivery_window_end as string)
          : null;
      const timeWindow = buildTimeWindow(windowStartRaw, windowEndRaw);
      const weightValue = getRouteTaskWeight(task);
      const demandValue = typeof weightValue === "number" ? weightValue : 1;
      const normalizedStartAddress = startAddress || undefined;
      const normalizedFinishAddress = finishAddress || undefined;
      const dropAddress =
        normalizedFinishAddress ?? normalizedStartAddress ?? undefined;
      acc.push({
        id: taskId,
        coordinates,
        demand: demandValue,
        weight: weightValue ?? undefined,
        serviceMinutes: undefined,
        title: task.title,
        startAddress: useDropPoint ? undefined : normalizedStartAddress,
        finishAddress: useDropPoint ? dropAddress : normalizedFinishAddress,
        timeWindow: timeWindow ?? undefined,
      });
      return acc;
    }, []);
  }, []);

  const taskWeightMap = React.useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach((task) => {
      if (!task) {
        return;
      }
      const id = getTaskIdentifier(task);
      if (!id) {
        return;
      }
      const weight = getRouteTaskWeight(task);
      if (typeof weight === "number") {
        map.set(id, weight);
      }
    });
    return map;
  }, [tasks]);

  const openAssignDialog = React.useCallback((vehicle: FleetVehicleDto) => {
    setAssignVehicle(vehicle);
    setAssignError("");
    setAssignResult(null);
    setAssignLoading(false);
    const initialSelection = extractVehicleTaskIds(vehicle);
    setAssignSelected(initialSelection);
  }, []);

  const closeAssignDialog = React.useCallback(() => {
    setAssignVehicle(null);
    setAssignSelected([]);
    setAssignError("");
    setAssignLoading(false);
    setAssignResult(null);
  }, []);

  const toggleAssignTask = React.useCallback((taskId: string) => {
    if (!taskId) {
      return;
    }
    setAssignSelected((prev) =>
      prev.includes(taskId)
        ? prev.filter((value) => value !== taskId)
        : [...prev, taskId],
    );
  }, []);

  const assignableTasks = React.useMemo(() => {
    if (!assignVehicle) {
      return [];
    }
    const vehicleType =
      typeof assignVehicle.transportType === "string"
        ? assignVehicle.transportType.trim().toLowerCase()
        : "";
    const polygons = bufferedPolygonsRef.current;
    const shouldFilterByZone = hasPolygonGeometry(polygons);
    const filtered = tasks.filter((task) => {
      const taskId = getTaskIdentifier(task);
      if (!taskId) {
        return false;
      }
      if (shouldFilterByZone) {
        if (!isTaskInsidePolygons(task, polygons)) {
          return false;
        }
      }
      const details = (task as Record<string, unknown>).logistics_details as
        | LogisticsDetails
        | undefined;
      const taskType =
        typeof details?.transport_type === "string"
          ? details.transport_type.trim().toLowerCase()
          : "";
      if (!taskType) {
        return false;
      }
      if (vehicleType && taskType && vehicleType !== taskType) {
        return false;
      }
      return true;
    });
    return filtered
      .slice()
      .sort((a, b) => (a.title || "").localeCompare(b.title || "", "ru"));
  }, [assignVehicle, tasks]);

  React.useEffect(() => {
    if (!assignVehicle) {
      return;
    }
    const allowed = new Set(
      assignableTasks.map((task) => getTaskIdentifier(task)).filter(Boolean),
    );
    setAssignSelected((prev) => prev.filter((id) => allowed.has(id)));
  }, [assignVehicle, assignableTasks]);

  const handleAssignConfirm = React.useCallback(async () => {
    if (!assignVehicle) {
      return;
    }
    const selectedSet = new Set(assignSelected);
    if (!selectedSet.size) {
      setAssignError(tRef.current("logistics.assignDialogSelectError"));
      return;
    }
    const selectedTasks = tasks.filter((task) =>
      selectedSet.has(getTaskIdentifier(task)),
    );
    if (!selectedTasks.length) {
      setAssignError(tRef.current("logistics.assignDialogSelectError"));
      return;
    }
    const payloadTasks = buildOptimizeTasks(selectedTasks);
    if (!payloadTasks.length) {
      setAssignError(tRef.current("logistics.assignDialogNoCoordinates"));
      return;
    }
    const capacity = normalizeVehicleCapacity(assignVehicle);
    const averageSpeed = method === "trip" ? 45 : 30;
    const payload: OptimizeRoutePayload = {
      tasks: payloadTasks,
      vehicleCapacity: capacity ?? Math.max(1, payloadTasks.length),
      vehicleCount: 1,
      averageSpeedKmph: averageSpeed,
    };
    setAssignLoading(true);
    setAssignError("");
    setAssignResult(null);
    try {
      const result = await optimizeRoute(payload);
      if (!result) {
        setAssignError(tRef.current("logistics.assignDialogError"));
        return;
      }
      setAssignResult(result);
      setAssignError("");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tRef.current("logistics.assignDialogError");
      setAssignError(message);
    } finally {
      setAssignLoading(false);
    }
  }, [
    assignSelected,
    assignVehicle,
    buildOptimizeTasks,
    method,
    optimizeRoute,
    tasks,
    tRef,
  ]);

  const assignCapacity = React.useMemo(
    () => (assignVehicle ? normalizeVehicleCapacity(assignVehicle) : null),
    [assignVehicle],
  );

  const assignCurrentLoad = React.useMemo(() => {
    if (!assignVehicle) {
      return null;
    }
    const ids = extractVehicleTaskIds(assignVehicle);
    if (!ids.length) {
      return 0;
    }
    let total = 0;
    ids.forEach((id) => {
      const weight = taskWeightMap.get(id);
      if (typeof weight === "number") {
        total += weight;
      }
    });
    return total;
  }, [assignVehicle, taskWeightMap]);

  const assignResultMessage = React.useMemo(() => {
    if (!assignResult) {
      return "";
    }
    return tRef.current("logistics.assignDialogResult", {
      load: formatLoad(assignResult.totalLoad),
      eta: formatEta(assignResult.totalEtaMinutes),
    });
  }, [assignResult, formatEta, formatLoad, tRef]);

  const calculate = React.useCallback(
    async (tasksOverride?: RouteTask[]) => {
      const sourceTasks = tasksOverride ?? sorted;
      const payloadTasks = buildOptimizeTasks(sourceTasks);

      if (!payloadTasks.length) {
        applyPlan(null);
        setPlanMessage(tRef.current("logistics.planEmpty"));
        setPlanMessageTone("neutral");
        return;
      }

      const averageSpeed = method === "trip" ? 45 : 30;
      const capacityValue =
        typeof optimizationVehicleCapacity === "number" &&
        Number.isFinite(optimizationVehicleCapacity) &&
        optimizationVehicleCapacity > 0
          ? optimizationVehicleCapacity
          : undefined;
      const payload: OptimizeRoutePayload = {
        tasks: payloadTasks,
        vehicleCapacity: capacityValue ?? Math.max(1, payloadTasks.length),
        vehicleCount: Math.max(1, vehicles),
        averageSpeedKmph: averageSpeed,
      };

      setPlanLoading(true);
      setPlanMessage("");
      setPlanMessageTone("neutral");
      try {
        const result = await optimizeRoute(payload);
        if (!result || !result.routes.length) {
          applyPlan(null);
          setPlanMessage(tRef.current("logistics.planEmpty"));
          return;
        }

        const nextPlan = buildPlanFromOptimization(result);
        if (!nextPlan) {
          applyPlan(null);
          setPlanMessage(tRef.current("logistics.planEmpty"));
          return;
        }

        applyPlan(nextPlan);
        const summaryParts = [
          tRef.current("logistics.planDraftCreated"),
          `${tRef.current("logistics.etaLabel")}: ${formatEta(result.totalEtaMinutes)}`,
          `${tRef.current("logistics.loadLabel")}: ${formatLoad(result.totalLoad)}`,
        ];
        if (result.warnings.length) {
          summaryParts.push(result.warnings.join("; "));
        }
        setPlanMessage(summaryParts.join(" · "));
        setPlanMessageTone(result.warnings.length ? "neutral" : "success");

        if (!mapRef.current) {
          return;
        }
        if (optLayerRef.current) {
          optLayerRef.current.remove();
        }
        const group = L.layerGroup();
        if (visibleLayers.optimized) {
          group.addTo(mapRef.current);
        }
        optLayerRef.current = group;
        const colors = ["#ef4444", "#22c55e", "#f97316"];
        nextPlan.routes.forEach((route, idx) => {
          const latlngs: Array<[number, number]> = [];
          route.tasks.forEach((task) => {
            if (task.start) {
              latlngs.push([task.start.lat, task.start.lng]);
            }
            if (task.finish) {
              latlngs.push([task.finish.lat, task.finish.lng]);
            }
          });
          if (latlngs.length < 2) {
            return;
          }
          L.polyline(latlngs, {
            color: colors[idx % colors.length],
            weight: 4,
          }).addTo(group);
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : tRef.current("logistics.planOptimizeError");
        setPlanMessage(message);
        setPlanMessageTone("error");
      } finally {
        setPlanLoading(false);
      }
    },
    [
      applyPlan,
      buildOptimizeTasks,
      buildPlanFromOptimization,
      formatEta,
      formatLoad,
      visibleLayers.optimized,
      optimizationVehicleCapacity,
      method,
      sorted,
      tRef,
      vehicles,
    ],
  );

  const scheduleAutoRecalculate = React.useCallback(
    (
      options: {
        refreshTasks?: boolean;
        refreshPlan?: boolean;
        recalc?: boolean;
      } = {},
    ) => {
      autoJobRef.current = {
        refreshTasks:
          autoJobRef.current.refreshTasks || Boolean(options.refreshTasks),
        refreshPlan:
          autoJobRef.current.refreshPlan || Boolean(options.refreshPlan),
        recalc: autoJobRef.current.recalc || Boolean(options.recalc),
      };
      if (autoTimerRef.current !== null) {
        return;
      }
      autoTimerRef.current = window.setTimeout(async () => {
        const job = autoJobRef.current;
        autoJobRef.current = {
          refreshTasks: false,
          refreshPlan: false,
          recalc: false,
        };
        autoTimerRef.current = null;
        try {
          if (job.refreshTasks) {
            await load();
          }
          if (job.refreshPlan) {
            await loadPlan();
          }
          if (job.recalc) {
            await calculate();
          }
        } catch (error) {
          console.error("Не удалось выполнить автообновление логистики", error);
        }
      }, 800);
    },
    [calculate, load, loadPlan],
  );

  React.useEffect(() => {
    if (!geozoneChangeInitRef.current) {
      geozoneChangeInitRef.current = true;
      return;
    }
    scheduleAutoRecalculate({ recalc: true });
  }, [drawnPolygons, scheduleAutoRecalculate]);

  const persistPlanDraft = React.useCallback(
    async (nextDraft: RoutePlan) => {
      if (!nextDraft.id) {
        return;
      }
      setPlanSyncing(true);
      try {
        const payload = buildUpdatePayload(nextDraft);
        const updated = await updateRoutePlan(nextDraft.id, payload);
        applyPlan(updated);
        setPlanMessage(tRef.current("logistics.planReorderSaved"));
        setPlanMessageTone("success");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : tRef.current("logistics.planReorderError");
        setPlanMessage(message);
        setPlanMessageTone("error");
        scheduleAutoRecalculate({ refreshPlan: true });
      } finally {
        setPlanSyncing(false);
      }
    },
    [applyPlan, buildUpdatePayload, scheduleAutoRecalculate, tRef],
  );

  const handleMoveTask = React.useCallback(
    ({
      taskId,
      sourceRouteIndex,
      fromIndex,
      targetRouteIndex,
      targetIndex,
    }: {
      taskId: string;
      sourceRouteIndex?: number;
      fromIndex?: number;
      targetRouteIndex: number;
      targetIndex: number;
    }) => {
      let nextDraft: RoutePlan | null = null;
      setPlanDraft((current) => {
        if (!current) return current;
        const draftCopy = clonePlan(current);
        if (!draftCopy) {
          return current;
        }
        let actualSourceRouteIndex =
          typeof sourceRouteIndex === "number"
            ? sourceRouteIndex
            : draftCopy.routes.findIndex((route) =>
                route.tasks.some((task) => task.taskId === taskId),
              );
        if (actualSourceRouteIndex < 0) {
          return current;
        }
        const sourceRoute = draftCopy.routes[actualSourceRouteIndex];
        let actualFromIndex =
          typeof fromIndex === "number" && fromIndex >= 0
            ? fromIndex
            : sourceRoute.tasks.findIndex((task) => task.taskId === taskId);
        if (actualFromIndex < 0) {
          return current;
        }
        const targetRoute = draftCopy.routes[targetRouteIndex];
        if (!targetRoute) {
          return current;
        }
        if (
          actualSourceRouteIndex === targetRouteIndex &&
          actualFromIndex === targetIndex
        ) {
          return current;
        }
        const [moved] = sourceRoute.tasks.splice(actualFromIndex, 1);
        let insertionIndex = targetIndex;
        if (actualSourceRouteIndex === targetRouteIndex) {
          if (actualFromIndex < insertionIndex) {
            insertionIndex -= 1;
          }
          insertionIndex = Math.max(
            0,
            Math.min(insertionIndex, sourceRoute.tasks.length),
          );
        } else {
          insertionIndex = Math.max(
            0,
            Math.min(insertionIndex, targetRoute.tasks.length),
          );
        }
        targetRoute.tasks.splice(insertionIndex, 0, moved);
        draftCopy.routes = draftCopy.routes.map((route, idx) => ({
          ...route,
          order: idx,
          tasks: route.tasks.map((task, order) => ({ ...task, order })),
        }));
        draftCopy.tasks = draftCopy.routes.flatMap((route) =>
          route.tasks.map((task) => task.taskId),
        );
        nextDraft = draftCopy;
        return draftCopy;
      });
      if (nextDraft) {
        void persistPlanDraft(nextDraft);
      }
    },
    [clonePlan, persistPlanDraft],
  );

  const updateTaskCoordinates = React.useCallback(
    async (
      taskId: string,
      payload: { kind: "start" | "finish"; coordinates: Coords },
    ) => {
      setRecalcInProgress(true);
      setPlanMessage(tRef.current("logistics.coordinatesUpdating"));
      setPlanMessageTone("neutral");
      setTaskStatus((prev) => {
        const next = new Map(prev);
        const current = next.get(taskId);
        if (current) {
          next.set(taskId, {
            ...current,
            recalculating: true,
            etaMinutes: null,
          });
        }
        return next;
      });
      try {
        const response = await authFetch(
          `/api/v1/tasks/${taskId}/coordinates`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              [payload.kind]: payload.coordinates,
            }),
          },
        );
        if (!response.ok) {
          let message = tRef.current("logistics.coordinatesUpdateError");
          try {
            const data = await response.clone().json();
            if (data && typeof data === "object") {
              const info = data as Record<string, unknown>;
              const raw =
                typeof info.message === "string"
                  ? info.message
                  : typeof info.error === "string"
                    ? info.error
                    : "";
              if (raw.trim()) {
                message = raw.trim();
              }
            }
          } catch {
            try {
              const text = await response.text();
              if (text.trim()) {
                message = text.trim();
              }
            } catch {
              // игнорируем
            }
          }
          throw new Error(message);
        }
        const nextSorted = sorted.map((task) => {
          if (task._id !== taskId) {
            return task;
          }
          const updated: RouteTask = { ...task };
          if (payload.kind === "start") {
            updated.startCoordinates = payload.coordinates;
          } else {
            updated.finishCoordinates = payload.coordinates;
          }
          return updated;
        });
        setSorted(nextSorted);
        await calculate(nextSorted);
        setPlanMessage(tRef.current("logistics.coordinatesUpdated"));
        setPlanMessageTone("success");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : tRef.current("logistics.coordinatesUpdateError");
        setPlanMessage(message);
        setPlanMessageTone("error");
      } finally {
        setTaskStatus((prev) => {
          const next = new Map(prev);
          const current = next.get(taskId);
          if (current) {
            next.set(taskId, { ...current, recalculating: false });
          }
          return next;
        });
        setRecalcInProgress(false);
      }
    },
    [calculate, sorted, tRef],
  );

  const handleTaskCoordinatesChange = React.useCallback(
    (taskId: string, kind: "start" | "finish", latlng: L.LatLng) => {
      const coordinates: Coords = {
        lat: Number(latlng.lat),
        lng: Number(latlng.lng),
      };
      void updateTaskCoordinates(taskId, { kind, coordinates });
    },
    [updateTaskCoordinates],
  );

  const planMessageClass = React.useMemo(() => {
    if (planMessageTone === "error") {
      return "text-sm text-red-600";
    }
    if (planMessageTone === "success") {
      return "text-sm text-emerald-600";
    }
    return "text-sm text-muted-foreground";
  }, [planMessageTone]);

  const planStatus: RoutePlanStatus =
    planDraft?.status ?? plan?.status ?? "draft";
  const planStatusLabel = t(`logistics.planStatusValue.${planStatus}`);
  const isPlanEditable = planStatus !== "completed";
  const draftRoutes = planDraft?.routes;
  const planRoutes = React.useMemo(() => draftRoutes ?? [], [draftRoutes]);
  const totalStops = React.useMemo(() => {
    if (typeof planDraft?.metrics?.totalStops === "number") {
      return planDraft.metrics.totalStops;
    }
    if (!planDraft) {
      return 0;
    }
    return planDraft.routes.reduce((acc, route) => acc + route.stops.length, 0);
  }, [planDraft]);
  const planTotalRoutes = planDraft?.metrics?.totalRoutes ?? planRoutes.length;
  const planTotalTasks =
    planDraft?.metrics?.totalTasks ?? planDraft?.tasks.length ?? 0;
  const planTotalEtaMinutes = planDraft?.metrics?.totalEtaMinutes ?? null;
  const planTotalLoad = planDraft?.metrics?.totalLoad ?? null;

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      if (!isPlanEditable || planLoading || planSyncing) {
        return;
      }
      const { active, over } = event;
      if (!over) {
        return;
      }
      const activeData = active.data.current as DragData | undefined;
      const overData = over.data.current as DragData | undefined;
      if (!activeData || activeData.type !== "task" || !overData) {
        return;
      }
      const taskId = String(active.id);
      let targetRouteIndex: number;
      let targetIndex: number;
      if (overData.type === "task") {
        targetRouteIndex = overData.routeIndex;
        targetIndex = overData.index;
      } else {
        targetRouteIndex = overData.routeIndex;
        const targetRoute = planRoutes[targetRouteIndex];
        targetIndex = targetRoute ? targetRoute.tasks.length : 0;
      }
      handleMoveTask({
        taskId,
        sourceRouteIndex: activeData.routeIndex,
        fromIndex: activeData.index,
        targetRouteIndex,
        targetIndex,
      });
    },
    [handleMoveTask, isPlanEditable, planLoading, planRoutes, planSyncing],
  );

  const routeAnalytics = React.useMemo(() => {
    const routeStatus = new Map<
      string,
      {
        overloaded: boolean;
        delayed: boolean;
        etaMinutes: number | null;
        load: number | null;
      }
    >();
    const taskStatus = new Map<
      string,
      {
        overloaded: boolean;
        delayed: boolean;
        delayMinutes: number;
        etaMinutes: number | null;
        routeLoad: number | null;
        routeId: string;
      }
    >();
    const stopDetails = new Map<
      string,
      {
        start?: RoutePlan["routes"][number]["stops"][number];
        finish?: RoutePlan["routes"][number]["stops"][number];
      }
    >();
    let maxLoadValue = 0;
    let maxEtaValue = 0;

    planRoutes.forEach((route) => {
      const loadValue =
        typeof route.metrics?.load === "number" &&
        Number.isFinite(route.metrics.load)
          ? Number(route.metrics.load)
          : null;
      const etaValue =
        typeof route.metrics?.etaMinutes === "number" &&
        Number.isFinite(route.metrics.etaMinutes)
          ? Number(route.metrics.etaMinutes)
          : null;
      if (typeof loadValue === "number" && loadValue > maxLoadValue) {
        maxLoadValue = loadValue;
      }
      if (typeof etaValue === "number" && etaValue > maxEtaValue) {
        maxEtaValue = etaValue;
      }
      route.tasks.forEach((taskRef) => {
        if (!stopDetails.has(taskRef.taskId)) {
          stopDetails.set(taskRef.taskId, {});
        }
      });
    });

    const loadThreshold =
      maxLoadValue > 0 ? maxLoadValue * LOAD_WARNING_RATIO : 0;
    const etaThresholdBase =
      maxEtaValue > 0 ? maxEtaValue * ETA_WARNING_RATIO : 0;
    const etaThreshold = Math.max(ETA_WARNING_MINUTES, etaThresholdBase);

    planRoutes.forEach((route, index) => {
      const routeId = route.id || `route-${index}`;
      const loadValue =
        typeof route.metrics?.load === "number" &&
        Number.isFinite(route.metrics.load)
          ? Number(route.metrics.load)
          : null;
      const etaValue =
        typeof route.metrics?.etaMinutes === "number" &&
        Number.isFinite(route.metrics.etaMinutes)
          ? Number(route.metrics.etaMinutes)
          : null;

      const overloaded =
        typeof loadValue === "number" && loadThreshold > 0
          ? loadValue >= loadThreshold
          : false;
      const delayed =
        typeof etaValue === "number" && etaThreshold > 0
          ? etaValue >= etaThreshold
          : false;

      routeStatus.set(routeId, {
        overloaded,
        delayed,
        etaMinutes: etaValue ?? null,
        load: loadValue ?? null,
      });

      route.tasks.forEach((taskRef) => {
        const key = taskRef.taskId;
        const current = taskStatus.get(key) ?? {
          overloaded: false,
          delayed: false,
          delayMinutes: 0,
          etaMinutes: null,
          routeLoad: null,
          routeId,
          recalculating: false,
        };
        current.overloaded = current.overloaded || overloaded;
        if (typeof etaValue === "number") {
          current.etaMinutes =
            typeof current.etaMinutes === "number"
              ? Math.max(current.etaMinutes, etaValue)
              : etaValue;
        }
        if (typeof loadValue === "number") {
          current.routeLoad = loadValue;
        }
        current.routeId = routeId;
        taskStatus.set(key, current);
      });

      route.stops.forEach((stop) => {
        const key = stop.taskId;
        if (!key) return;
        const current = taskStatus.get(key) ?? {
          overloaded,
          delayed: false,
          delayMinutes: 0,
          etaMinutes: null,
          routeLoad: loadValue ?? null,
          routeId,
          recalculating: false,
        };
        if (typeof stop.delayMinutes === "number" && stop.delayMinutes > 0) {
          current.delayed = true;
          current.delayMinutes = Math.max(
            current.delayMinutes,
            stop.delayMinutes,
          );
        }
        if (typeof stop.etaMinutes === "number") {
          current.etaMinutes =
            typeof current.etaMinutes === "number"
              ? Math.max(current.etaMinutes, stop.etaMinutes)
              : stop.etaMinutes;
        }
        if (typeof loadValue === "number") {
          current.routeLoad = loadValue;
        }
        current.routeId = routeId;
        taskStatus.set(key, current);

        const info = stopDetails.get(key) ?? {};
        if (stop.kind === "start") {
          info.start = stop;
        } else {
          info.finish = stop;
        }
        stopDetails.set(key, info);
      });
    });

    return {
      maxLoad: maxLoadValue,
      maxEta: maxEtaValue,
      routeStatus,
      taskStatus,
      stopDetails,
    };
  }, [planRoutes]);

  const {
    maxLoad,
    maxEta,
    routeStatus,
    taskStatus: rawAnalyticsTaskStatus,
    stopDetails,
  } = routeAnalytics;

  const analyticsTaskStatus = React.useMemo(() => {
    if (!zoneTaskIds) {
      return rawAnalyticsTaskStatus;
    }
    const filtered = new Map<string, TaskStatusInfo>();
    rawAnalyticsTaskStatus.forEach((value, key) => {
      if (zoneTaskIds.has(key)) {
        filtered.set(key, value);
      }
    });
    return filtered;
  }, [rawAnalyticsTaskStatus, zoneTaskIds]);

  const [taskStatus, setTaskStatus] = React.useState<
    Map<string, TaskStatusInfo>
  >(() => {
    const initial = new Map<string, TaskStatusInfo>();
    analyticsTaskStatus.forEach((value, key) => {
      initial.set(key, { ...value });
    });
    return initial;
  });

  React.useEffect(() => {
    setTaskStatus((prev) => {
      const next = new Map<string, TaskStatusInfo>();
      analyticsTaskStatus.forEach((value, key) => {
        const previous = prev.get(key);
        next.set(key, {
          ...value,
          recalculating: previous?.recalculating ?? false,
        });
      });
      return next;
    });
  }, [analyticsTaskStatus]);

  const vehiclesOnMap = React.useMemo(() => {
    const items: {
      id: string;
      vehicle: FleetVehicleDto;
      coordinates: Coords;
      updatedAt: string | null;
      speedKph: number | null;
    }[] = [];
    const seen = new Set<string>();
    availableVehicles.forEach((vehicle) => {
      if (!vehicle || typeof vehicle.id !== "string") {
        return;
      }
      if (seen.has(vehicle.id)) {
        return;
      }
      seen.add(vehicle.id);
      const override = vehiclePositions[vehicle.id];
      const coords = override?.coordinates ?? vehicle.coordinates ?? null;
      if (
        !coords ||
        typeof coords.lat !== "number" ||
        typeof coords.lng !== "number" ||
        !Number.isFinite(coords.lat) ||
        !Number.isFinite(coords.lng)
      ) {
        return;
      }
      const updatedAt =
        override?.updatedAt ?? vehicle.coordinatesUpdatedAt ?? null;
      const speedValue =
        override?.speedKph ??
        (typeof vehicle.currentSpeedKph === "number" &&
        Number.isFinite(vehicle.currentSpeedKph)
          ? vehicle.currentSpeedKph
          : null);
      items.push({
        id: vehicle.id,
        vehicle,
        coordinates: coords,
        updatedAt,
        speedKph: speedValue ?? null,
      });
    });
    return items;
  }, [availableVehicles, vehiclePositions]);

  const loadSeries = React.useMemo(
    () =>
      planRoutes.map((route, idx) => {
        const key = route.id || `route-${idx}`;
        const displayIndex =
          typeof route.order === "number" && Number.isFinite(route.order)
            ? route.order + 1
            : idx + 1;
        const value =
          typeof route.metrics?.load === "number" &&
          Number.isFinite(route.metrics.load)
            ? Number(route.metrics.load)
            : 0;
        return {
          key,
          index: displayIndex,
          value,
          highlighted: routeStatus.get(key)?.overloaded ?? false,
        };
      }),
    [planRoutes, routeStatus],
  );

  const etaSeries = React.useMemo(
    () =>
      planRoutes.map((route, idx) => {
        const key = route.id || `route-${idx}`;
        const displayIndex =
          typeof route.order === "number" && Number.isFinite(route.order)
            ? route.order + 1
            : idx + 1;
        const value =
          typeof route.metrics?.etaMinutes === "number" &&
          Number.isFinite(route.metrics.etaMinutes)
            ? Number(route.metrics.etaMinutes)
            : 0;
        return {
          key,
          index: displayIndex,
          value,
          highlighted: routeStatus.get(key)?.delayed ?? false,
        };
      }),
    [planRoutes, routeStatus],
  );

  const reset = React.useCallback(() => {
    if (optLayerRef.current) {
      optLayerRef.current.remove();
      optLayerRef.current = null;
    }
    setLinks([]);
  }, []);

  React.useEffect(
    () => () => {
      if (autoTimerRef.current !== null) {
        window.clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    },
    [],
  );

  React.useEffect(() => {
    void load();
  }, [load, location.key]);

  React.useEffect(() => {
    setPage(0);
  }, [tasks]);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return () => undefined;
    }
    const unsubscribe = subscribeLogisticsEvents(
      (event) => {
        if (event.type === "tasks.changed") {
          scheduleAutoRecalculate({
            refreshTasks: true,
            refreshPlan: true,
            recalc: true,
          });
        } else if (event.type === "route-plan.updated") {
          applyPlan(event.plan);
          setPlanMessage(tRef.current("logistics.planSaved"));
          setPlanMessageTone("success");
        } else if (event.type === "route-plan.removed") {
          applyPlan(null);
          setPlanMessage(tRef.current("logistics.planEmpty"));
          setPlanMessageTone("neutral");
        } else if (event.type === "fleet.position.updated") {
          const { vehicleId, coordinates, updatedAt, speedKph } = event;
          if (!vehicleId || !coordinates) {
            return;
          }
          const lat = Number(coordinates.lat);
          const lng = Number(coordinates.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return;
          }
          setVehiclePositions((current) => {
            const prev = current[vehicleId];
            const normalizedSpeed =
              typeof speedKph === "number" && Number.isFinite(speedKph)
                ? speedKph
                : null;
            const nextValue = {
              coordinates: { lat, lng } satisfies Coords,
              updatedAt: typeof updatedAt === "string" ? updatedAt : null,
              speedKph: normalizedSpeed,
            } as const;
            if (
              prev &&
              prev.coordinates.lat === nextValue.coordinates.lat &&
              prev.coordinates.lng === nextValue.coordinates.lng &&
              prev.updatedAt === nextValue.updatedAt &&
              prev.speedKph === nextValue.speedKph
            ) {
              return current;
            }
            return {
              ...current,
              [vehicleId]: nextValue,
            };
          });
        }
      },
      () => {
        setPlanMessage(tRef.current("logistics.planLoadError"));
        setPlanMessageTone("error");
      },
    );
    return () => {
      unsubscribe();
    };
  }, [applyPlan, scheduleAutoRecalculate, tRef]);

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
    setVehiclePositions((current) => {
      let nextState = current;
      const allowed = new Set<string>();
      availableVehicles.forEach((vehicle) => {
        if (!vehicle || typeof vehicle.id !== "string") {
          return;
        }
        const id = vehicle.id;
        allowed.add(id);
        const coords = vehicle.coordinates;
        const hasCoords =
          coords &&
          typeof coords.lat === "number" &&
          Number.isFinite(coords.lat) &&
          typeof coords.lng === "number" &&
          Number.isFinite(coords.lng);
        if (!hasCoords) {
          return;
        }
        const speedValue =
          typeof vehicle.currentSpeedKph === "number" &&
          Number.isFinite(vehicle.currentSpeedKph)
            ? vehicle.currentSpeedKph
            : null;
        const updatedAtValue =
          typeof vehicle.coordinatesUpdatedAt === "string"
            ? vehicle.coordinatesUpdatedAt
            : null;
        const prev = current[id];
        if (
          !prev ||
          prev.coordinates.lat !== coords.lat ||
          prev.coordinates.lng !== coords.lng ||
          prev.updatedAt !== updatedAtValue ||
          prev.speedKph !== speedValue
        ) {
          if (nextState === current) {
            nextState = { ...current };
          }
          nextState[id] = {
            coordinates: coords,
            updatedAt: updatedAtValue,
            speedKph: speedValue,
          };
        }
      });
      if (nextState === current) {
        const missing = Object.keys(current).some((id) => !allowed.has(id));
        if (!missing) {
          return current;
        }
        nextState = { ...current };
      }
      Object.keys(nextState).forEach((id) => {
        if (!allowed.has(id)) {
          delete nextState[id];
        }
      });
      return nextState;
    });
  }, [availableVehicles]);

  React.useEffect(() => {
    if (hasDialog) return;
    if (mapRef.current) return;
    const map = L.map("logistics-map", {
      maxBounds: UKRAINE_BOUNDS,
      maxBoundsViscosity: 1,
      minZoom: 5,
      maxZoom: 12,
    }).setView(MAP_CENTER, MAP_ZOOM);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    tasksLayerRef.current = L.layerGroup().addTo(map);
    vehicleLayerRef.current = L.layerGroup();
    setMapReady(true);
    return () => {
      map.remove();
      if (optLayerRef.current) optLayerRef.current.remove();
      tasksLayerRef.current = null;
      if (vehicleLayerRef.current) {
        vehicleLayerRef.current.remove();
      }
      vehicleLayerRef.current = null;
      if (trafficLayerRef.current) {
        trafficLayerRef.current.remove();
      }
      if (cargoLayerRef.current) {
        cargoLayerRef.current.remove();
      }
      trafficLayerRef.current = null;
      cargoLayerRef.current = null;
      mapRef.current = null;
      setMapReady(false);
    };
  }, [hasDialog]);

  React.useEffect(() => {
    if (hasDialog) return;
    const container = mapLibreContainerRef.current;
    if (!container) return;
    if (mapLibreRef.current) return;
    const map = new maplibregl.Map({
      container,
      style: MAPLIBRE_STYLE_URL,
      center: [MAP_CENTER[1], MAP_CENTER[0]],
      zoom: MAP_ZOOM,
      attributionControl: false,
    });
    mapLibreRef.current = map;
    const navigation = new maplibregl.NavigationControl({
      showCompass: false,
    });
    map.addControl(navigation, "top-right");
    const drawControl = new MapLibreDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
    });
    drawControlRef.current = drawControl;
    map.addControl(drawControl as unknown as maplibregl.IControl, "top-left");
    let cancelled = false;
    const updateSource = (collection: MapFeatureCollection) => {
      const source = map.getSource(
        MAPLIBRE_POLYGON_SOURCE_ID,
      ) as GeoJSONSource | undefined;
      source?.setData(collection);
    };
    const ensureSource = () => {
      const existing = map.getSource(MAPLIBRE_POLYGON_SOURCE_ID);
      const initial = cloneFeatureCollection(drawnPolygonsRef.current);
      if (!existing) {
        map.addSource(MAPLIBRE_POLYGON_SOURCE_ID, {
          type: "geojson",
          data: initial,
        });
        map.addLayer({
          id: MAPLIBRE_POLYGON_FILL_LAYER_ID,
          type: "fill",
          source: MAPLIBRE_POLYGON_SOURCE_ID,
          paint: {
            "fill-color": "#6366f1",
            "fill-opacity": 0.18,
          },
        });
        map.addLayer({
          id: MAPLIBRE_POLYGON_LINE_LAYER_ID,
          type: "line",
          source: MAPLIBRE_POLYGON_SOURCE_ID,
          paint: {
            "line-color": "#4338ca",
            "line-width": 2,
            "line-dasharray": [2, 2],
          },
        });
      } else {
        updateSource(initial);
      }
      if (initial.features.length) {
        drawControl.set(initial);
      }
      if (!cancelled) {
        setMapLibreReady(true);
      }
    };
    const maybeLoaded = (
      map as unknown as { isStyleLoaded?: () => boolean }
    ).isStyleLoaded;
    if (typeof maybeLoaded === "function" && maybeLoaded()) {
      ensureSource();
    } else {
      map.once("load", ensureSource);
    }
    const handleModeChange = (event: { mode?: unknown }) => {
      const mode = typeof event.mode === "string" ? event.mode : "";
      setIsDrawing(mode.startsWith("draw_"));
    };
    const syncDrawFeatures = (collection?: MapFeatureCollection) => {
      const rawCollection =
        collection ?? (drawControl.getAll() as MapFeatureCollection);
      const nextCollection = cloneFeatureCollection(rawCollection);
      if (!areFeatureCollectionsEqual(nextCollection, drawnPolygonsRef.current)) {
        setDrawnPolygons(nextCollection);
      } else {
        updateSource(nextCollection);
      }
    };
    const handleDrawCreate = (event: DrawEventPayload) => {
      syncDrawFeatures();
      const createdId = getFeatureId(event?.features?.[0]);
      if (createdId) {
        setActiveGeozoneId(createdId);
      }
    };
    const handleDrawUpdate = () => {
      syncDrawFeatures();
    };
    const handleDrawDelete = (event: DrawEventPayload) => {
      syncDrawFeatures();
      const removedIds = (event?.features ?? [])
        .map((feature) => getFeatureId(feature))
        .filter((value): value is string => Boolean(value));
      if (removedIds.length) {
        setActiveGeozoneId((current) =>
          current && removedIds.includes(current) ? null : current,
        );
      }
    };
    const handleSelectionChange = (event: DrawEventPayload) => {
      const selectedId = getFeatureId(event?.features?.[0]);
      setActiveGeozoneId(selectedId);
    };
    map.on("draw.modechange", handleModeChange);
    map.on("draw.create", handleDrawCreate);
    map.on("draw.update", handleDrawUpdate);
    map.on("draw.delete", handleDrawDelete);
    map.on("draw.selectionchange", handleSelectionChange);
    return () => {
      cancelled = true;
      setIsDrawing(false);
      setMapLibreReady(false);
      map.off("draw.modechange", handleModeChange);
      map.off("draw.create", handleDrawCreate);
      map.off("draw.update", handleDrawUpdate);
      map.off("draw.delete", handleDrawDelete);
      map.off("draw.selectionchange", handleSelectionChange);
      map.off("load", ensureSource);
      drawControlRef.current = null;
      map.remove();
      mapLibreRef.current = null;
    };
  }, [hasDialog]);

  React.useEffect(() => {
    if (!mapLibreReady) return;
    const map = mapLibreRef.current;
    if (!map) return;
    const source = map.getSource(
      MAPLIBRE_POLYGON_SOURCE_ID,
    ) as GeoJSONSource | undefined;
    source?.setData(cloneFeatureCollection(drawnPolygons));
  }, [drawnPolygons, mapLibreReady]);

  React.useEffect(() => {
    if (!mapLibreReady) return;
    const drawControl = drawControlRef.current;
    if (!drawControl) return;
    const collection = drawControl.getAll() as MapFeatureCollection;
    if (!areFeatureCollectionsEqual(collection, drawnPolygons)) {
      drawControl.deleteAll();
      if (drawnPolygons.features.length) {
        drawControl.set(cloneFeatureCollection(drawnPolygons));
      }
    }
  }, [drawnPolygons, mapLibreReady]);

  React.useEffect(() => {
    if (!activeGeozoneId) {
      return;
    }
    const exists = drawnPolygons.features.some(
      (feature) => getFeatureId(feature) === activeGeozoneId,
    );
    if (!exists) {
      setActiveGeozoneId(null);
    }
  }, [activeGeozoneId, drawnPolygons]);

  React.useEffect(() => {
    if (!mapLibreReady) return;
    const drawControl = drawControlRef.current;
    if (!drawControl) return;
    const selectedIds = drawControl.getSelectedIds();
    if (activeGeozoneId) {
      if (selectedIds.length === 1 && selectedIds[0] === activeGeozoneId) {
        return;
      }
      drawControl.changeMode("simple_select", { featureIds: [activeGeozoneId] });
    } else if (selectedIds.length) {
      drawControl.changeMode("simple_select", { featureIds: [] });
    }
  }, [activeGeozoneId, mapLibreReady]);

  React.useEffect(() => {
    if (!mapLibreReady) return;
    const map = mapLibreRef.current;
    if (!map) return;
    map.resize();
  }, [mapLibreReady, isMapExpanded, hasDialog]);

  React.useEffect(() => {
    if (!mapRef.current || !optLayerRef.current) return;
    if (visibleLayers.optimized) {
      optLayerRef.current.addTo(mapRef.current);
    } else {
      optLayerRef.current.remove();
    }
  }, [visibleLayers.optimized]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    if (!vehicleLayerRef.current) {
      vehicleLayerRef.current = L.layerGroup();
    }
    const layer = vehicleLayerRef.current;
    if (!layer) return;
    if (visibleLayers.transport) {
      layer.addTo(map);
    } else {
      layer.remove();
      layer.clearLayers();
    }
  }, [visibleLayers.transport, mapReady]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    if (visibleLayers.traffic) {
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = L.tileLayer(TRAFFIC_TILE_URL, {
          opacity: 0.6,
        });
      }
      trafficLayerRef.current.addTo(map);
    } else if (trafficLayerRef.current) {
      trafficLayerRef.current.remove();
    }
  }, [visibleLayers.traffic, mapReady]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    if (visibleLayers.cargo) {
      if (!cargoLayerRef.current) {
        cargoLayerRef.current = L.tileLayer(CARGO_TILE_URL, {
          opacity: 0.5,
        });
      }
      cargoLayerRef.current.addTo(map);
    } else if (cargoLayerRef.current) {
      cargoLayerRef.current.remove();
    }
  }, [visibleLayers.cargo, mapReady]);

  React.useEffect(() => {
    const group = tasksLayerRef.current;
    if (!mapRef.current || !group || !mapReady) return;
    group.clearLayers();
    if (!visibleLayers.tasks) return;
    if (!sorted.length) return;
    const createMarkerIcon = (kind: "start" | "finish", color: string) =>
      L.divIcon({
        className: `task-marker task-marker--${kind}`,
        html: `<span style="--marker-color:${color}"></span>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
    let cancelled = false;
    (async () => {
      for (const t of sorted) {
        if (!t.startCoordinates || !t.finishCoordinates || cancelled) continue;
        const coords = (await fetchRouteGeometry(
          t.startCoordinates,
          t.finishCoordinates,
        )) as [number, number][] | null;
        if (!coords || cancelled) continue;
        const latlngs = coords.map(
          ([lng, lat]) => [lat, lng] as [number, number],
        );
        const statusKey = typeof t.status === "string" ? t.status.trim() : "";
        const taskInfo = taskStatus.get(t._id);
        const defaultColor = TASK_STATUS_COLORS[statusKey] ?? "#2563eb";
        let routeColor = defaultColor;
        if (taskInfo?.overloaded) {
          routeColor = "#dc2626";
        } else if (taskInfo?.delayed) {
          routeColor = "#f97316";
        }
        const markerColor = taskInfo?.delayed ? "#f97316" : routeColor;
        const stopInfo = stopDetails.get(t._id);
        const tooltipParts = [
          `<div class="font-semibold">${escapeHtml(t.title ?? t._id ?? "")}</div>`,
          `<div>${escapeHtml(tRef.current("logistics.etaLabel"))}: ${escapeHtml(
            formatEta(taskInfo?.etaMinutes ?? null),
          )}</div>`,
          `<div>${escapeHtml(tRef.current("logistics.loadLabel"))}: ${escapeHtml(
            formatLoad(taskInfo?.routeLoad ?? null),
          )}</div>`,
          `<div class="${taskInfo?.delayed ? "text-red-600" : "text-emerald-600"}">${escapeHtml(
            formatDelay(taskInfo?.delayMinutes ?? null),
          )}</div>`,
        ];
        if (stopInfo?.start?.address) {
          tooltipParts.push(
            `<div>${escapeHtml(tRef.current("logistics.stopPickupShort"))}: ${escapeHtml(
              stopInfo.start.address,
            )}</div>`,
          );
        }
        if (stopInfo?.finish?.address) {
          tooltipParts.push(
            `<div>${escapeHtml(tRef.current("logistics.stopDropoffShort"))}: ${escapeHtml(
              stopInfo.finish.address,
            )}</div>`,
          );
        }
        const tooltipHtml = `<div class="space-y-1 text-xs">${tooltipParts.join("")}</div>`;
        L.polyline(latlngs, {
          color: routeColor,
          weight: 4,
          opacity: 0.85,
        }).addTo(group);
        const startMarker = L.marker(latlngs[0], {
          icon: createMarkerIcon("start", markerColor),
          draggable: true,
        }).bindTooltip(tooltipHtml, { opacity: 0.95 });
        const endMarker = L.marker(latlngs[latlngs.length - 1], {
          icon: createMarkerIcon("finish", markerColor),
          draggable: true,
        }).bindTooltip(tooltipHtml, { opacity: 0.95 });
        startMarker.on("click", () => openTask(t._id));
        endMarker.on("click", () => openTask(t._id));
        startMarker.on("dragend", (event) => {
          const marker = event.target as L.Marker;
          handleTaskCoordinatesChange(t._id, "start", marker.getLatLng());
        });
        endMarker.on("dragend", (event) => {
          const marker = event.target as L.Marker;
          handleTaskCoordinatesChange(t._id, "finish", marker.getLatLng());
        });
        startMarker.addTo(group);
        endMarker.addTo(group);
      }
    })();
    return () => {
      cancelled = true;
      group.clearLayers();
    };
  }, [
    formatDelay,
    formatEta,
    formatLoad,
    visibleLayers.tasks,
    mapReady,
    openTask,
    sorted,
    stopDetails,
    taskStatus,
    handleTaskCoordinatesChange,
    tRef,
  ]);

  React.useEffect(() => {
    const layer = vehicleLayerRef.current;
    if (!layer || !mapReady) return;
    layer.clearLayers();
    if (!visibleLayers.transport) return;
    if (!vehiclesOnMap.length) return;
    vehiclesOnMap.forEach(({ vehicle, coordinates, updatedAt, speedKph }) => {
      const marker = L.circleMarker([coordinates.lat, coordinates.lng], {
        radius: 6,
        color: "#0f172a",
        weight: 2,
        fillColor: "#22c55e",
        fillOpacity: 0.9,
      });
      const tooltipParts = [
        `<div class="font-semibold">${escapeHtml(vehicle.name)}</div>`,
      ];
      if (vehicle.registrationNumber) {
        tooltipParts.push(
          `<div>${escapeHtml(vehicle.registrationNumber)}</div>`,
        );
      }
      if (speedKph !== null) {
        const speedLabel = `${Math.round(speedKph * 10) / 10} ${escapeHtml(
          tRef.current("logistics.speedUnit", {
            defaultValue: "км/ч",
          }),
        )}`;
        tooltipParts.push(
          `<div>${escapeHtml(
            tRef.current("logistics.vehicleSpeed", {
              value: speedLabel,
              defaultValue: `Скорость: ${speedLabel}`,
            }),
          )}</div>`,
        );
      }
      let updatedLabel = tRef.current("logistics.vehicleNoTimestamp", {
        defaultValue: "Нет данных",
      });
      if (updatedAt) {
        const parsed = new Date(updatedAt);
        if (!Number.isNaN(parsed.getTime())) {
          updatedLabel = positionTimeFormatter.format(parsed);
        }
      }
      tooltipParts.push(
        `<div>${escapeHtml(
          tRef.current("logistics.vehicleUpdatedAt", {
            value: updatedLabel,
            defaultValue: `Обновлено: ${updatedLabel}`,
          }),
        )}</div>`,
      );
      marker.bindTooltip(
        `<div class="space-y-1 text-xs">${tooltipParts.join("")}</div>`,
        { opacity: 0.95 },
      );
      marker.addTo(layer);
    });
    return () => {
      layer.clearLayers();
    };
  }, [tRef, vehiclesOnMap, visibleLayers.transport, mapReady]);

  React.useEffect(() => {
    if (hasDialog) return;
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    if (typeof map.invalidateSize === "function") {
      map.invalidateSize();
    }
  }, [hasDialog, mapReady, isMapExpanded]);

  const mapHeight = React.useMemo(
    () => (isMapExpanded ? 520 : 280),
    [isMapExpanded],
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <h2 className="text-xl font-semibold">{t("logistics.title")}</h2>
      <section className="space-y-3 rounded border bg-white/80 p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">
              {t("logistics.planSectionTitle")}
            </h3>
            <p className="text-muted-foreground text-sm">
              {t("logistics.planSummary")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {t("logistics.planStatus")}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tracking-wide text-slate-700 uppercase">
              {planStatusLabel}
            </span>
            {planLoading ? (
              <span className="text-muted-foreground text-xs">
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
            disabled={planLoading || planSyncing}
          >
            {planLoading ? t("loading") : t("logistics.planReload")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClearPlan}
            disabled={planLoading || planSyncing}
          >
            {t("logistics.planClear")}
          </Button>
          <Button
            type="button"
            onClick={handleSavePlan}
            disabled={
              !planDraft || !isPlanEditable || planLoading || planSyncing
            }
          >
            {t("save")}
          </Button>
          {planDraft?.status === "draft" ? (
            <Button
              type="button"
              variant="success"
              onClick={handleApprovePlan}
              disabled={planLoading || planSyncing}
            >
              {t("logistics.planApprove")}
            </Button>
          ) : null}
          {planDraft?.status === "approved" ? (
            <Button
              type="button"
              variant="success"
              onClick={handleCompletePlan}
              disabled={planLoading || planSyncing}
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
                  disabled={!isPlanEditable || planLoading || planSyncing}
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
                  disabled={!isPlanEditable || planLoading || planSyncing}
                />
              </label>
            </div>
            <div className="space-y-2">
              <h4 className="text-muted-foreground text-sm font-semibold uppercase">
                {t("logistics.planSummary")}
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="text-muted-foreground text-xs uppercase">
                    {t("logistics.planTotalDistance")}
                  </div>
                  <div className="font-semibold">
                    {formatDistance(planDraft.metrics?.totalDistanceKm ?? null)}
                  </div>
                </div>
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="text-muted-foreground text-xs uppercase">
                    {t("logistics.planTotalRoutes")}
                  </div>
                  <div className="font-semibold">{planTotalRoutes}</div>
                </div>
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="text-muted-foreground text-xs uppercase">
                    {t("logistics.planTotalTasks")}
                  </div>
                  <div className="font-semibold">{planTotalTasks}</div>
                </div>
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="text-muted-foreground text-xs uppercase">
                    {t("logistics.planTotalStops")}
                  </div>
                  <div className="font-semibold">{totalStops}</div>
                </div>
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="text-muted-foreground text-xs uppercase">
                    {t("logistics.planTotalEta")}
                  </div>
                  <div className="font-semibold">
                    {formatEta(planTotalEtaMinutes)}
                  </div>
                </div>
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="text-muted-foreground text-xs uppercase">
                    {t("logistics.planTotalLoad")}
                  </div>
                  <div className="font-semibold">
                    {formatLoad(planTotalLoad)}
                  </div>
                </div>
              </div>
            </div>
            {planRoutes.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="text-muted-foreground flex items-center justify-between text-xs uppercase">
                    <span>{t("logistics.routeLoadChartTitle")}</span>
                    <span>{formatLoad(maxLoad)}</span>
                  </div>
                  <svg
                    className="mt-3 w-full"
                    height={140}
                    viewBox={`0 0 ${Math.max(120, loadSeries.length * 44)} 140`}
                    role="img"
                    aria-label={t("logistics.routeLoadChartTitle")}
                  >
                    {loadSeries.map((item, idx) => {
                      const ratio =
                        maxLoad > 0
                          ? Math.min(1, Math.max(0, item.value / maxLoad))
                          : 0;
                      const barHeight = Math.max(8, Math.round(ratio * 96));
                      const x = 16 + idx * 44;
                      const y = 120 - barHeight;
                      const width = 24;
                      const color = item.highlighted ? "#ef4444" : "#0ea5e9";
                      return (
                        <g key={item.key}>
                          <rect
                            x={x}
                            y={y}
                            width={width}
                            height={barHeight}
                            rx={4}
                            fill={color}
                          >
                            <title>
                              {t("logistics.loadBarTooltip", {
                                index: item.index,
                                value: formatLoad(item.value),
                              })}
                            </title>
                          </rect>
                          <text
                            x={x + width / 2}
                            y={132}
                            textAnchor="middle"
                            className="fill-slate-500 text-[10px]"
                          >
                            {t("logistics.planRouteShort", {
                              index: item.index,
                            })}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="text-muted-foreground flex items-center justify-between text-xs uppercase">
                    <span>{t("logistics.routeEtaChartTitle")}</span>
                    <span>{formatEta(maxEta)}</span>
                  </div>
                  <svg
                    className="mt-3 w-full"
                    height={140}
                    viewBox={`0 0 ${Math.max(120, etaSeries.length * 44)} 140`}
                    role="img"
                    aria-label={t("logistics.routeEtaChartTitle")}
                  >
                    {etaSeries.map((item, idx) => {
                      const ratio =
                        maxEta > 0
                          ? Math.min(1, Math.max(0, item.value / maxEta))
                          : 0;
                      const barHeight = Math.max(8, Math.round(ratio * 96));
                      const x = 16 + idx * 44;
                      const y = 120 - barHeight;
                      const width = 24;
                      const color = item.highlighted ? "#f97316" : "#6366f1";
                      return (
                        <g key={item.key}>
                          <rect
                            x={x}
                            y={y}
                            width={width}
                            height={barHeight}
                            rx={4}
                            fill={color}
                          >
                            <title>
                              {t("logistics.etaBarTooltip", {
                                index: item.index,
                                value: formatEta(item.value),
                              })}
                            </title>
                          </rect>
                          <text
                            x={x + width / 2}
                            y={132}
                            textAnchor="middle"
                            className="fill-slate-500 text-[10px]"
                          >
                            {t("logistics.planRouteShort", {
                              index: item.index,
                            })}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            ) : null}
            <div className="space-y-3">
              {isPlanEditable || planSyncing || recalcInProgress ? (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {isPlanEditable ? (
                    <span className="text-muted-foreground">
                      {t("logistics.planDragHint")}
                    </span>
                  ) : null}
                  {planSyncing ? (
                    <span className="flex items-center gap-1 text-indigo-600">
                      <span className="h-2 w-2 animate-ping rounded-full bg-indigo-500" />
                      {t("logistics.planReorderSync")}
                    </span>
                  ) : null}
                  {recalcInProgress ? (
                    <span className="flex items-center gap-1 text-indigo-600">
                      <span className="h-2 w-2 animate-ping rounded-full bg-indigo-400" />
                      {t("logistics.recalculateInProgress")}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                {planRoutes.map((route, routeIndex) => {
                  const displayIndex =
                    typeof route.order === "number" &&
                    Number.isFinite(route.order)
                      ? route.order + 1
                      : routeIndex + 1;
                  const routeKey =
                    typeof route.id === "string" && route.id
                      ? route.id
                      : `route-${routeIndex}`;
                  const routeInfo = routeStatus.get(routeKey);
                  const loadValue =
                    typeof route.metrics?.load === "number" &&
                    Number.isFinite(route.metrics?.load)
                      ? Number(route.metrics?.load)
                      : null;
                  const etaValue =
                    typeof route.metrics?.etaMinutes === "number" &&
                    Number.isFinite(route.metrics?.etaMinutes)
                      ? Number(route.metrics?.etaMinutes)
                      : null;
                  const loadRatio =
                    maxLoad > 0 && typeof loadValue === "number"
                      ? Math.min(1, Math.max(0, loadValue / maxLoad))
                      : 0;
                  const etaRatio =
                    maxEta > 0 && typeof etaValue === "number"
                      ? Math.min(1, Math.max(0, etaValue / maxEta))
                      : 0;
                  const loadPercent = Math.round(loadRatio * 100);
                  const etaPercent = Math.round(etaRatio * 100);
                  const loadWidth = Math.min(100, Math.max(6, loadPercent));
                  const etaWidth = Math.min(100, Math.max(6, etaPercent));
                  const routeStops = route.metrics?.stops ?? route.stops.length;
                  return (
                    <div
                      key={route.id || `${routeIndex}`}
                      className="space-y-3 rounded border bg-white/70 px-3 py-3 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="text-base font-semibold">
                            {t("logistics.planRouteTitle", {
                              index: displayIndex,
                            })}
                          </h4>
                          <div className="text-muted-foreground text-xs">
                            {t("logistics.planRouteSummary", {
                              tasks: route.tasks.length,
                              stops: routeStops,
                            })}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {routeInfo?.overloaded ? (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-red-700 uppercase">
                                {t("logistics.overloadedBadge")}
                              </span>
                            ) : null}
                            {routeInfo?.delayed ? (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-amber-700 uppercase">
                                {t("logistics.delayBadge")}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {t("logistics.planRouteDistance", {
                            distance: formatDistance(
                              route.metrics?.distanceKm ?? null,
                            ),
                          })}
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <div className="text-muted-foreground flex items-center justify-between text-xs font-semibold uppercase">
                            <span>{t("logistics.routeLoadLabel")}</span>
                            <span>{formatLoad(loadValue)}</span>
                          </div>
                          <div
                            className="h-2 rounded-full bg-slate-200"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={loadPercent}
                          >
                            <div
                              className={clsx(
                                "h-2 rounded-full transition-all",
                                routeInfo?.overloaded
                                  ? "bg-red-500"
                                  : "bg-emerald-500",
                              )}
                              style={{ width: `${loadWidth}%` }}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-muted-foreground flex items-center justify-between text-xs font-semibold uppercase">
                            <span>{t("logistics.routeEtaLabel")}</span>
                            <span>{formatEta(etaValue)}</span>
                          </div>
                          <div
                            className="h-2 rounded-full bg-slate-200"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={etaPercent}
                          >
                            <div
                              className={clsx(
                                "h-2 rounded-full transition-all",
                                routeInfo?.delayed
                                  ? "bg-amber-500"
                                  : "bg-blue-500",
                              )}
                              style={{ width: `${etaWidth}%` }}
                            />
                          </div>
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
                              handleDriverNameChange(
                                routeIndex,
                                event.target.value,
                              )
                            }
                            disabled={
                              !isPlanEditable || planLoading || planSyncing
                            }
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                          <span className="font-medium">
                            {t("logistics.planVehicle")}
                          </span>
                          <Input
                            value={route.vehicleName ?? ""}
                            onChange={(event) =>
                              handleVehicleNameChange(
                                routeIndex,
                                event.target.value,
                              )
                            }
                            disabled={
                              !isPlanEditable || planLoading || planSyncing
                            }
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm md:col-span-2">
                          <span className="font-medium">
                            {t("logistics.planRouteNotes")}
                          </span>
                          <textarea
                            value={route.notes ?? ""}
                            onChange={(event) =>
                              handleRouteNotesChange(
                                routeIndex,
                                event.target.value,
                              )
                            }
                            className="min-h-[80px] rounded border px-3 py-2 text-sm"
                            disabled={
                              !isPlanEditable || planLoading || planSyncing
                            }
                          />
                        </label>
                        <div className="space-y-2 md:col-span-2">
                          <RouteTaskList
                            route={route}
                            routeIndex={routeIndex}
                            t={t}
                            formatLoad={formatLoad}
                            formatEta={formatEta}
                            formatDelay={formatDelay}
                            formatDistance={formatDistance}
                            taskStatus={taskStatus}
                            loadValue={loadValue}
                            etaValue={etaValue}
                            isPlanEditable={isPlanEditable}
                            planLoading={planLoading || planSyncing}
                          />
                          <div className="overflow-x-auto">
                            <table className="min-w-full table-fixed text-left text-xs">
                              <thead>
                                <tr className="text-muted-foreground">
                                  <th className="px-2 py-1 font-semibold">
                                    {t("logistics.stopTableHeaderStop")}
                                  </th>
                                  <th className="px-2 py-1 font-semibold">
                                    {t("logistics.stopTableHeaderEta")}
                                  </th>
                                  <th className="px-2 py-1 font-semibold">
                                    {t("logistics.stopTableHeaderLoad")}
                                  </th>
                                  <th className="px-2 py-1 font-semibold">
                                    {t("logistics.stopTableHeaderWindow")}
                                  </th>
                                  <th className="px-2 py-1 font-semibold">
                                    {t("logistics.stopTableHeaderDelay")}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {route.stops.length ? (
                                  route.stops.map((stop) => {
                                    const stopDelay = stop.delayMinutes ?? null;
                                    const stopLoadAlert =
                                      typeof stop.load === "number" &&
                                      maxLoad > 0
                                        ? stop.load >=
                                          maxLoad * LOAD_WARNING_RATIO
                                        : false;
                                    const stopRowClass = clsx(
                                      "border-t border-slate-200",
                                      {
                                        "bg-red-50":
                                          typeof stopDelay === "number" &&
                                          stopDelay > 0,
                                        "bg-amber-50":
                                          (!stopDelay || stopDelay <= 0) &&
                                          stopLoadAlert,
                                      },
                                    );
                                    const stopLoadRatio =
                                      maxLoad > 0 &&
                                      typeof stop.load === "number"
                                        ? Math.min(
                                            1,
                                            Math.max(0, stop.load / maxLoad),
                                          )
                                        : 0;
                                    const stopLoadWidth = Math.min(
                                      100,
                                      Math.max(
                                        4,
                                        Math.round(stopLoadRatio * 100),
                                      ),
                                    );
                                    return (
                                      <tr
                                        key={`${stop.taskId}-${stop.kind}-${stop.order}`}
                                        className={stopRowClass}
                                      >
                                        <td className="px-2 py-1 font-medium">
                                          {stop.kind === "start"
                                            ? t("logistics.stopPickup", {
                                                index: stop.order + 1,
                                              })
                                            : t("logistics.stopDropoff", {
                                                index: stop.order + 1,
                                              })}
                                        </td>
                                        <td
                                          className="px-2 py-1"
                                          title={formatEta(
                                            stop.etaMinutes ?? null,
                                          )}
                                        >
                                          {formatEta(stop.etaMinutes ?? null)}
                                        </td>
                                        <td className="px-2 py-1">
                                          <div className="flex items-center gap-2">
                                            <div className="h-2 flex-1 rounded-full bg-slate-200">
                                              <div
                                                className="h-2 rounded-full bg-indigo-500"
                                                style={{
                                                  width: `${stopLoadWidth}%`,
                                                }}
                                              />
                                            </div>
                                            <span className="whitespace-nowrap">
                                              {formatLoad(stop.load ?? null)}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-2 py-1">
                                          {formatWindow(
                                            stop.windowStartMinutes ?? null,
                                            stop.windowEndMinutes ?? null,
                                          )}
                                        </td>
                                        <td className="px-2 py-1">
                                          <span
                                            className={clsx({
                                              "font-semibold text-red-600":
                                                typeof stopDelay === "number" &&
                                                stopDelay > 0,
                                            })}
                                          >
                                            {formatDelay(stopDelay)}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })
                                ) : (
                                  <tr>
                                    <td
                                      className="text-muted-foreground px-2 py-2 text-center text-sm"
                                      colSpan={5}
                                    >
                                      {t("logistics.planRouteEmpty")}
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </DndContext>
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
            <div className="text-muted-foreground text-sm">{vehiclesHint}</div>
          ) : null}
          <FleetTable
            vehicles={availableVehicles}
            taskWeightMap={taskWeightMap}
            onAssign={openAssignDialog}
          />
        </section>
      ) : fleetError ? (
        <p className="text-muted-foreground rounded border border-dashed p-3 text-sm">
          {fleetError}
        </p>
      ) : null}
      <section className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-3 rounded border bg-white/80 p-3 shadow-sm">
          <div
            id="logistics-map"
            className={clsx(
              "w-full rounded border bg-slate-50/40 transition-[height] duration-300 ease-out",
              { hidden: hasDialog },
            )}
            style={{ height: mapHeight }}
          />
          <div
            ref={mapLibreContainerRef}
            className={clsx(
              "relative w-full overflow-hidden rounded border bg-slate-50/40",
              { hidden: hasDialog },
            )}
            style={{ height: mapHeight }}
          >
            {!mapLibreReady ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
                {t("logistics.mapLibreLoading", {
                  defaultValue: "Инициализация слоя рисования…",
                })}
              </div>
            ) : null}
            {isDrawing ? (
              <div className="pointer-events-none absolute left-2 top-2 rounded bg-indigo-500/90 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
                {t("logistics.mapDrawing", {
                  defaultValue: "Режим рисования",
                })}
              </div>
            ) : null}
          </div>
          <p className="text-muted-foreground text-xs">
            {t("logistics.mapPolygonCount", {
              count: drawnPolygons.features.length,
              defaultValue: "Полигонов: {{count}}",
            })}
          </p>
          <div className="space-y-2 rounded border bg-white/70 p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {t("logistics.geozonesTitle", { defaultValue: "Геозоны" })}
              </h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleClearGeozones}
                disabled={!geozoneItems.length}
              >
                {t("logistics.geozoneClear", {
                  defaultValue: "Очистить",
                })}
              </Button>
            </div>
            {geozoneItems.length ? (
              <ul className="space-y-1 text-sm">
                {geozoneItems.map((zone) => (
                  <li key={zone.key} className="flex items-start gap-2">
                    <div className="flex-1 space-y-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={zone.active ? "default" : "outline"}
                        className="flex w-full justify-start"
                        aria-pressed={zone.active}
                        onClick={() =>
                          zone.id
                            ? handleSelectGeozone(zone.active ? null : zone.id)
                            : undefined
                        }
                        disabled={!zone.id}
                      >
                        {zone.label}
                      </Button>
                      <div className="text-muted-foreground flex flex-col text-[11px] leading-4">
                        <span>{formatGeozoneArea(zone.areaSqKm)}</span>
                        <span>{formatGeozonePerimeter(zone.perimeterKm)}</span>
                        {geozoneBufferLabel ? (
                          <span>{geozoneBufferLabel}</span>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => zone.id && handleDeleteGeozone(zone.id)}
                      disabled={!zone.id}
                      aria-label={t("logistics.geozoneDeleteAria", {
                        name: zone.label,
                        defaultValue: `Удалить геозону ${zone.label}`,
                      })}
                      title={t("logistics.geozoneDeleteAria", {
                        name: zone.label,
                        defaultValue: `Удалить геозону ${zone.label}`,
                      })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-xs">
                {t("logistics.geozoneEmpty", {
                  defaultValue: "Геозоны не добавлены",
                })}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs font-medium uppercase">
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
                <span className="text-muted-foreground text-xs font-medium uppercase">
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
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsMapExpanded((prev) => !prev)}
                aria-pressed={isMapExpanded}
              >
                {isMapExpanded
                  ? t("logistics.mapCollapse", {
                      defaultValue: "Свернуть карту",
                    })
                  : t("logistics.mapExpand", {
                      defaultValue: "Развернуть карту",
                    })}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  void calculate();
                }}
              >
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
        </div>
        <div className="space-y-3">
          <section className="space-y-2 rounded border bg-white/80 p-3 shadow-sm">
            <h3 className="text-sm font-semibold">
              {t("logistics.layersTitle")}
            </h3>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={visibleLayers.tasks}
                  onChange={(event) =>
                    setVisibleLayers((prev) => ({
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
                  checked={visibleLayers.optimized}
                  onChange={(event) =>
                    setVisibleLayers((prev) => ({
                      ...prev,
                      optimized: event.target.checked,
                    }))
                  }
                />
                <span>{t("logistics.layerOptimization")}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={visibleLayers.transport}
                  onChange={(event) =>
                    setVisibleLayers((prev) => ({
                      ...prev,
                      transport: event.target.checked,
                    }))
                  }
                />
                <span>
                  {t("logistics.layerTransport", {
                    defaultValue: "Транспорт",
                  })}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={visibleLayers.traffic}
                  onChange={(event) =>
                    setVisibleLayers((prev) => ({
                      ...prev,
                      traffic: event.target.checked,
                    }))
                  }
                />
                <span>
                  {t("logistics.layerTraffic", {
                    defaultValue: "Пробки",
                  })}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={visibleLayers.cargo}
                  onChange={(event) =>
                    setVisibleLayers((prev) => ({
                      ...prev,
                      cargo: event.target.checked,
                    }))
                  }
                />
                <span>
                  {t("logistics.layerCargo", {
                    defaultValue: "Грузы",
                  })}
                </span>
              </label>
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
          <section className="space-y-2 rounded border bg-white/80 p-3 shadow-sm">
            <h3 className="text-sm font-semibold">
              {t("logistics.legendTitle")}
            </h3>
            <ul className="space-y-2 text-sm">
              {legendItems.map((item) => (
                <li key={item.key} className="flex items-center gap-2">
                  <span
                    className="legend-color"
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </li>
              ))}
              <li className="flex items-center gap-2">
                <span
                  className="task-marker task-marker--start"
                  aria-hidden="true"
                >
                  <span
                    style={
                      { "--marker-color": "#2563eb" } as React.CSSProperties
                    }
                  />
                </span>
                <span>{t("logistics.legendStart")}</span>
              </li>
              <li className="flex items-center gap-2">
                <span
                  className="task-marker task-marker--finish"
                  aria-hidden="true"
                >
                  <span
                    style={
                      { "--marker-color": "#2563eb" } as React.CSSProperties
                    }
                  />
                </span>
                <span>{t("logistics.legendFinish")}</span>
              </li>
            </ul>
          </section>
        </div>
      </section>
      <section className="space-y-2 rounded border bg-white/80 p-3 shadow-sm">
        <h3 className="text-lg font-semibold">{t("logistics.tasksHeading")}</h3>
        <TaskTable
          tasks={displayedTasks}
          onDataChange={handleTableDataChange}
          onRowClick={openTask}
          page={page}
          pageCount={Math.max(1, Math.ceil(displayedTasks.length / 25))}
          onPageChange={setPage}
        />
      </section>
      <Modal open={Boolean(assignVehicle)} onClose={closeAssignDialog}>
        {assignVehicle ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">
                {t("logistics.assignDialogTitle", {
                  name:
                    assignVehicle.name?.trim() ||
                    t("logistics.assignDialogUnknownVehicle"),
                })}
              </h3>
              {assignVehicle.registrationNumber ? (
                <p className="text-muted-foreground text-sm">
                  {t("logistics.assignDialogRegistration", {
                    value: assignVehicle.registrationNumber,
                  })}
                </p>
              ) : null}
              <p className="text-muted-foreground text-xs">
                {t("logistics.assignDialogHint")}
              </p>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded border bg-slate-50/60 p-2">
                <div className="text-muted-foreground text-xs uppercase">
                  {t("logistics.assignDialogCapacityLabel")}
                </div>
                <div className="font-semibold">
                  {assignCapacity !== null
                    ? `${assignCapacity.toLocaleString("ru-RU")} кг`
                    : t("logistics.assignDialogUnknown")}
                </div>
              </div>
              <div className="rounded border bg-slate-50/60 p-2">
                <div className="text-muted-foreground text-xs uppercase">
                  {t("logistics.assignDialogLoadLabel")}
                </div>
                <div className="font-semibold">
                  {assignCurrentLoad !== null
                    ? `${assignCurrentLoad.toLocaleString("ru-RU")} кг`
                    : t("logistics.assignDialogUnknown")}
                </div>
              </div>
            </div>
            {assignError ? (
              <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                {assignError}
              </div>
            ) : null}
            {assignResult ? (
              <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">
                {assignResultMessage}
              </div>
            ) : null}
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {assignableTasks.length ? (
                assignableTasks.map((task, index) => {
                  const taskId = getTaskIdentifier(task);
                  const checked = taskId
                    ? assignSelected.includes(taskId)
                    : false;
                  const weight = getRouteTaskWeight(task);
                  const key = taskId || `${index}`;
                  return (
                    <label
                      key={key}
                      className={clsx(
                        "flex items-start gap-2 rounded border p-2 text-sm transition-colors",
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-slate-200 bg-white",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        onChange={() => toggleAssignTask(taskId)}
                        disabled={!taskId}
                      />
                      <div className="space-y-1">
                        <div className="font-semibold">
                          {task.title || taskId || t("task")}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {weight !== null
                            ? t("logistics.assignDialogTaskWeight", {
                                value: weight.toLocaleString("ru-RU"),
                              })
                            : t("logistics.assignDialogTaskWeightUnknown")}
                        </div>
                      </div>
                    </label>
                  );
                })
              ) : (
                <div className="text-muted-foreground rounded border border-dashed p-3 text-sm">
                  {t("logistics.assignDialogEmpty")}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeAssignDialog}
                disabled={assignLoading}
              >
                {t("logistics.assignDialogCancel")}
              </Button>
              <Button
                type="button"
                onClick={() => void handleAssignConfirm()}
                disabled={assignLoading || !assignSelected.length}
              >
                {assignLoading
                  ? t("logistics.assignDialogSubmitting")
                  : t("logistics.assignDialogSubmit")}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
